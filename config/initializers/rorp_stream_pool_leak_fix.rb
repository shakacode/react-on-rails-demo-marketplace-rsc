# frozen_string_literal: true

# TEMPORARY MONKEY-PATCH for shakacode/react_on_rails#3295
#
# Delete this file once the upstream fix ships in a release.
#
# ── The bug ────────────────────────────────────────────────────────────────
# ReactOnRailsPro's streaming-render path never tells HTTPX "I'm done with
# this stream" when the consumer fiber is interrupted (client disconnect →
# `Async::Barrier#stop` kills the producer fiber mid-`@session.request`). The
# h2 stream is abandoned with no fiber driving its consume loop, the
# connection never returns to the pool's idle list, and
# `@origin_counters[origin]` grows by 1 per leak. After
# `renderer_http_pool_size` (default 10) such leaks every later streaming
# render dies with `HTTPX::PoolTimeoutError` in ~10s until Rails restarts.
#
# ── Why the "obvious" fix (request.emit(:refuse, :cancel)) is wrong ─────────
# That's the channel HTTPX's gRPC plugin uses for client-side cancel, and in
# isolation it correctly releases the slot. BUT it must be called from the
# writer fiber (the producer fiber is frozen inside HTTPX's non-Async-aware
# IO selector and never reaches a yield point — see issue thread). Calling it
# from the writer fiber while a *different* producer fiber is concurrently
# inside the SAME shared persistent h2 connection's `consume` loop desyncs
# the Connection counters from the h2 parser's stream table. HTTPX's
# `no_more_requests_loop_check` then spins 50× and raises
# `HTTPX::Error: connection corrupted, aborted after looping for a while`.
# The poisoned connection stays in the pool and every subsequent render that
# reuses it 500s in ~10–20ms. Reproduced locally and observed in prod
# (99 "connection corrupted" / 0 PoolTimeoutError after deploying the
# emit(:refuse) version). Single-stream cancel from outside the connection's
# own event loop is fundamentally unsafe on a multiplexed connection.
#
# ── The fix ────────────────────────────────────────────────────────────────
# On client-disconnect cancel, do NOT surgically cancel one stream. Tear the
# whole HTTPX session down cleanly via `ReactOnRailsPro::Request.reset_connection`
# (mutex-guarded: swap in a fresh connection, close the old one). This:
#   • releases every leaked slot (old connection fully closed),
#   • never leaves partial cross-fiber state → never corrupts,
#   • the next render opens a fresh session with an empty pool.
# Cost: any concurrent in-flight renders on that session die and must be
# retried. For this demo (~1–2 disconnects/day, low concurrency) that's
# negligible, and verified clean+immediate recovery under a concurrent
# disconnect burst locally.
#
# Wiring mirrors the upstream sketch (CancellableAsyncBarrier + on_cancel
# registration in consumer_stream_async) so the eventual gem fix can slot in.

require "react_on_rails_pro/stream_request"
require "react_on_rails_pro/concerns/stream"

module RORPStreamLeakFix
  # Applied to each request's @async_barrier via .extend (Async::Barrier
  # itself is untouched). Adds on_cancel + a stop override that fires the
  # callbacks synchronously, from the writer fiber, before the real stop.
  module CancellableBarrierMixin
    def on_cancel(&block)
      if @rorp_cancelled
        begin
          block.call
        rescue StandardError => e
          Rails.logger.warn { "[RORPStreamLeakFix] late on_cancel raised #{e.class}: #{e.message}" } if defined?(Rails.logger)
        end
        return
      end
      (@rorp_cancel_callbacks ||= []) << block
    end

    def stop(*args, &blk)
      unless @rorp_cancelled
        @rorp_cancelled = true
        callbacks = @rorp_cancel_callbacks || []
        @rorp_cancel_callbacks = []
        callbacks.each do |cb|
          cb.call
        rescue StandardError => e
          Rails.logger.warn { "[RORPStreamLeakFix] cancel callback raised #{e.class}: #{e.message}" } if defined?(Rails.logger)
        end
      end
      super
    end
  end

  # StreamRequest: capture the HTTPX::StreamResponse so #cancel can tell
  # whether the render actually finished (in which case there's nothing to
  # do — the slot returned naturally) before resetting the session.
  module StreamRequestPatch
    def initialize(&request_block)
      wrapped = lambda do |send_bundle, barrier|
        sr = request_block.call(send_bundle, barrier)
        if sr
          @rorp_stream_response = sr
          # Remember which HTTPX session this stream is bound to, so #cancel
          # only resets THAT session — not a fresh one a sibling cancel
          # already swapped in (coalesces reset bursts; see codex review #1).
          @rorp_session = ReactOnRailsPro::Request.instance_variable_get(:@connection)
        end
        sr
      end
      super(&wrapped)
    end

    def cancel
      sr = @rorp_stream_response
      return unless sr

      @rorp_stream_response = nil # idempotent

      req = sr.respond_to?(:request) ? sr.request : nil
      return unless req

      resp = req.response
      # Both HTTPX::Response and HTTPX::ErrorResponse implement #finished?
      # (ErrorResponse is always finished). If the render already finished,
      # the slot returned naturally — nothing to reset.
      return if resp.respond_to?(:finished?) && resp.finished?

      # Unfinished stream abandoned by a killed producer fiber → its slot
      # would leak. Reset the whole HTTPX session (clean teardown, no
      # cross-fiber partial mutation, no corruption).
      #
      # Coalesce reset bursts: only reset if the session this stream used is
      # still the active one. If a sibling cancel already reset it, the
      # current session is fresh and uninvolved — leave it alone (codex
      # review #1: avoids resetting a session another request just started
      # using).
      current = ReactOnRailsPro::Request.instance_variable_get(:@connection)
      if @rorp_session && current && !current.equal?(@rorp_session)
        Rails.logger.info { "[RORPStreamLeakFix] skip reset — session already rotated by a sibling cancel" } if defined?(Rails.logger)
        return
      end

      Rails.logger.info { "[RORPStreamLeakFix] resetting HTTPX session to release abandoned RSC stream" } if defined?(Rails.logger)
      ReactOnRailsPro::Request.reset_connection
    rescue StandardError => e
      Rails.logger.warn { "[RORPStreamLeakFix] cancel error: #{e.class}: #{e.message}" } if defined?(Rails.logger)
    end
  end

  module StreamDecoratorPatch
    def cancel
      @component.cancel if @component.respond_to?(:cancel)
    end
  end

  # Wrap consumer_stream_async's block so that the instant the stream is
  # yielded we register an on_cancel callback for it and extend the barrier.
  # `super` runs the rest — no body duplication.
  module ConsumerStreamAsyncPatch
    def consumer_stream_async(on_complete:, &original_block)
      barrier = @async_barrier
      if barrier && !barrier.is_a?(CancellableBarrierMixin)
        barrier.extend(CancellableBarrierMixin)
      end

      wrapped_block = proc do
        stream = original_block.call
        if stream && barrier.respond_to?(:on_cancel)
          barrier.on_cancel do
            stream.cancel if stream.respond_to?(:cancel)
          end
        end
        stream
      end

      super(on_complete: on_complete, &wrapped_block)
    end
  end
end

ReactOnRailsPro::StreamRequest.prepend(RORPStreamLeakFix::StreamRequestPatch)
ReactOnRailsPro::StreamDecorator.prepend(RORPStreamLeakFix::StreamDecoratorPatch)

# ReactOnRailsProHelper is an ActionView helper Rails autoloads lazily; the
# constant may not exist at initializer time, so defer the prepend.
Rails.application.config.to_prepare do
  unless ReactOnRailsProHelper.include?(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
    ReactOnRailsProHelper.prepend(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
  end
end

Rails.logger.info { "[RORPStreamLeakFix] monkey-patch active (issue shakacode/react_on_rails#3295)" } if defined?(Rails.logger)

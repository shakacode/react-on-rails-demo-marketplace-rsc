# frozen_string_literal: true

# TEMPORARY MONKEY-PATCH for shakacode/react_on_rails#3295
# Delete this file once the upstream fix ships in a release.
#
# ── The bug ────────────────────────────────────────────────────────────────
# On client disconnect, ReactOnRailsPro abandons the in-flight streaming
# request to the node renderer. The killed/abandoned producer fiber never
# tells HTTPX it's done, so the h2 connection never returns to the pool's
# idle list. After `renderer_http_pool_size` (default 10) leaks, every later
# streaming render dies with `HTTPX::PoolTimeoutError` (~10s) until restart.
#
# ── Why surgical per-stream cancel does NOT work ───────────────────────────
# `request.emit(:refuse, :cancel)` (HTTPX's internal cancel channel) only
# works safely if performed by the one fiber that owns the connection's
# event loop, with that loop NOT running. In ReactOnRailsPro every available
# trigger fails that condition:
#   • from the writer fiber (barrier.stop): another fiber is mid-`consume`
#     on the shared h2 connection → its Connection counters / h2 parser
#     stream-table desync → HTTPX raises
#     "connection corrupted, aborted after looping for a while", and every
#     later render that reuses that pooled connection 500s.
#   • from the producer fiber: it only regains control at a chunk boundary,
#     and the gem's own `return false if response.stream.closed?` is a
#     non-local return that ALSO rips through `@session.request`
#     mid-HTTPX-frame — same corruption.
# Both were reproduced locally and observed in prod (deploying the
# emit(:refuse) version produced 99 "connection corrupted" / 0
# PoolTimeoutError). A single-stream cancel from outside the connection's
# own settled event loop is fundamentally unsafe on a shared multiplexed
# connection.
#
# ── The fix ────────────────────────────────────────────────────────────────
# Don't surgically cancel one stream. On client-disconnect cancel, tear the
# whole HTTPX session down cleanly via `ReactOnRailsPro::Request.reset_connection`
# (mutex-guarded: build a fresh session, swap it in, close the old one). A
# full session swap-and-close has NO partial cross-fiber state to desync →
# it never corrupts, and closing the old connections releases every leaked
# slot. The next render opens a fresh session with an empty pool.
#
# Reset bursts are coalesced by session identity: each stream remembers the
# session it was created on; cancel only resets if that session is still the
# active one (a sibling cancel may have already rotated it).
#
# Trade-off: concurrent in-flight renders on a session that gets reset die
# and must be retried. For this demo (~1-2 disconnects/day, low concurrency)
# that's negligible. This is a temporary demo workaround, not a general fix
# (the real fix belongs in HTTPX/ReactOnRailsPro — see issue #3295).

require "react_on_rails_pro/stream_request"
require "react_on_rails_pro/concerns/stream"

module RORPStreamLeakFix
  # Extended onto each request's @async_barrier via .extend. Adds on_cancel
  # + a stop override that fires callbacks synchronously (from the writer
  # fiber) before the real Async::Barrier#stop.
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

  module StreamRequestPatch
    def initialize(&request_block)
      wrapped = lambda do |send_bundle, barrier|
        sr = request_block.call(send_bundle, barrier)
        if sr
          @rorp_stream_response = sr
          # Which HTTPX session this stream is bound to (for reset coalescing).
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
      # Render finished on its own → slot already returned, nothing to do.
      # (Both HTTPX::Response and HTTPX::ErrorResponse implement #finished?.)
      return if resp.respond_to?(:finished?) && resp.finished?

      # Coalesce reset bursts: only reset if THIS stream's session is still
      # the active one. If a sibling cancel already rotated it, the current
      # session is fresh and uninvolved — leave it alone.
      current = ReactOnRailsPro::Request.instance_variable_get(:@connection)
      return if @rorp_session && current && !current.equal?(@rorp_session)

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

# ReactOnRailsProHelper is autoloaded lazily; defer the prepend.
Rails.application.config.to_prepare do
  unless ReactOnRailsProHelper.include?(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
    ReactOnRailsProHelper.prepend(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
  end
end

Rails.logger.info { "[RORPStreamLeakFix] reset-connection monkey-patch active (issue shakacode/react_on_rails#3295)" } if defined?(Rails.logger)

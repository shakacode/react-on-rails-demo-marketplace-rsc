# frozen_string_literal: true

# TEMPORARY MONKEY-PATCH for shakacode/react_on_rails#3295
#
# Mirrors the upstream sketch in ror-v16.3.0-wt1 (CancellableAsyncBarrier
# + StreamRequest#cancel + on_cancel registration in consumer_stream_async),
# but implemented as Rails-app-side prepends so we don't need a gem fork.
# Delete this file once the upstream PR ships in a release.
#
# Why this is needed: ReactOnRailsPro's streaming-render path never tells
# HTTPX "I'm done with this stream" when the consumer fiber is interrupted
# (client disconnect, Async::Barrier#stop). The h2 stream stays in flight,
# its connection never returns to the pool's idle list,
# `@origin_counters[origin]` grows by 1 per leak. After
# `renderer_http_pool_size` (default 10) such leaks every later streaming
# render dies with `HTTPX::PoolTimeoutError` in ~10s until Rails restart.
#
# How we fix it: when the writer fiber catches ClientDisconnected and calls
# `@async_barrier.stop`, we run a per-stream cancel callback FIRST that
# issues `request.emit(:refuse, :cancel)` on each in-flight HTTPX
# StreamResponse. That sends RST_STREAM, the renderer closes its side,
# HTTPX's selector returns, the producer fiber's queued Async::Stop
# delivers, and `barrier.wait` returns instead of deadlocking. The pool
# slot is reclaimed immediately because `on_stream_refuse` synchronously
# decrements `Connection#@inflight`.

require "react_on_rails_pro/stream_request"
require "react_on_rails_pro/concerns/stream"

module RORPStreamLeakFix
  # Mixin applied to the per-request @async_barrier via .extend (so we
  # don't touch Async::Barrier globally). Adds on_cancel/stop callbacks.
  module CancellableBarrierMixin
    def on_cancel(&block)
      if @rorp_cancelled
        # Stop already fired — invoke immediately so a late-registering
        # producer fiber still gets its stream cancelled.
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

  # StreamRequest: capture the HTTPX::StreamResponse when @request_executor
  # returns it, and expose a cancel method that releases the HTTPX pool
  # slot via `request.emit(:refuse, :cancel)` (the same channel HTTPX's
  # gRPC plugin uses for client-side cancellation).
  module StreamRequestPatch
    def initialize(&request_block)
      wrapped = lambda do |send_bundle, barrier|
        sr = request_block.call(send_bundle, barrier)
        @rorp_stream_response = sr if sr
        sr
      end
      super(&wrapped)
    end

    def cancel
      sr = @rorp_stream_response
      return unless sr

      @rorp_stream_response = nil  # idempotent

      req = sr.respond_to?(:request) ? sr.request : nil
      return unless req

      resp = req.response
      # Both HTTPX::Response and HTTPX::ErrorResponse implement #finished?
      # (ErrorResponse is always finished). Re-emitting :refuse on either
      # would overwrite the terminal response with a synthetic cancel error.
      # Both HTTPX::Response and HTTPX::ErrorResponse implement #finished?
      # (ErrorResponse is always finished). Re-emitting :refuse on either
      # would overwrite the terminal response with a synthetic cancel error.
      return if resp.respond_to?(:finished?) && resp.finished?

      req.emit(:refuse, :cancel)
    rescue StandardError => e
      Rails.logger.warn { "[RORPStreamLeakFix] cancel error: #{e.class}: #{e.message}" } if defined?(Rails.logger)
    end
  end

  # StreamDecorator: forward cancel to the wrapped component.
  module StreamDecoratorPatch
    def cancel
      @component.cancel if @component.respond_to?(:cancel)
    end
  end

  # ReactOnRailsProHelper#consumer_stream_async: wrap the caller's block
  # so that immediately after the stream is yielded, we register an
  # on_cancel callback that will free its HTTPX resources if the barrier
  # is stopped. We also extend @async_barrier with our CancellableBarrierMixin
  # on entry. This way we don't need to duplicate the body of
  # consumer_stream_async — super does the rest.
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

# ReactOnRailsProHelper is an ActionView helper that Rails autoloads lazily
# from the gem's `app/helpers/`. The constant may not exist yet at initializer
# time, so defer the prepend to `to_prepare` (which runs after Rails has
# wired up engines in both prod and dev-reload modes).
Rails.application.config.to_prepare do
  unless ReactOnRailsProHelper.include?(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
    ReactOnRailsProHelper.prepend(RORPStreamLeakFix::ConsumerStreamAsyncPatch)
  end
end

Rails.logger.info { "[RORPStreamLeakFix] monkey-patch active (issue shakacode/react_on_rails#3295)" } if defined?(Rails.logger)

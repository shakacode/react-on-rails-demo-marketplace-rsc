# frozen_string_literal: true

# TEMPORARY WORKAROUND for shakacode/react_on_rails#3295
#
# Bug: ReactOnRailsPro streaming-render code never closes its HTTPX
# StreamResponse when the consumer fiber is interrupted (client disconnect,
# mid-stream exception, Async::Barrier#stop). The underlying h2 stream stays
# half-open, HTTPX keeps the pool slot in-flight, and after
# `renderer_http_pool_size` (default 10) such aborts every later streaming
# render dies with `HTTPX::PoolTimeoutError` in ~10 s until process restart.
# Classic SSR is unaffected (slot returns cleanly), so in production the
# symptom is "/rsc, /blog/rsc, /product/rsc … all 500 in exactly 10 s while
# /blog/ssr keeps working."
#
# Why this isn't fixed by calling `stream_response.close` on the abort path:
# HTTPX's stream_bidi plugin treats `request.close` as "send END_STREAM on
# the request half" and `response.close` as "buffer cleanup". Neither
# guarantees the receive-side h2 stream is released, and calling close on a
# stream whose response side has already completed corrupts the *shared*
# h2 connection — subsequent requests on that connection get
# `IOError: closed stream` instantly. (Verified by reproduction; see
# https://github.com/shakacode/react_on_rails/issues/3295.) So we don't
# attempt per-stream cleanup here.
#
# Two-layer self-heal (until the upstream patch in #3295 ships):
#
#   1. **Reset on pool-exhaustion in `StreamRequest#each_chunk`**. Both
#      streaming paths (`render_code_as_stream` for one-shot streaming, and
#      `render_code_with_incremental_updates` for async-props streaming)
#      funnel through `StreamRequest#each_chunk`. Prepend it: if the call
#      raises `HTTPX::PoolTimeoutError` (or `ReactOnRailsPro::Error` whose
#      message names PoolTimeoutError), call
#      `ReactOnRailsPro::Request.reset_connection`. That closes the entire
#      HTTPX session and the next request opens a fresh one with an empty
#      pool. One unlucky user gets a 500; everyone after them gets a working
#      app, no Rails restart required.
#
#   2. **Pool-size bump to 20** (default is 10). Doubles the runway before
#      the first exhaustion event so the self-heal needs to fire less often.
#
# Remove this file once #3295 lands.

require "react_on_rails_pro/stream_request"
require "react_on_rails_pro/request"

module RORPStreamPoolHeal
  def each_chunk(&block)
    return super unless block

    super
  rescue StandardError => e
    if RORPStreamPoolHeal.pool_timeout?(e)
      Rails.logger.warn do
        "[RORPStreamPoolLeakFix] HTTPX pool exhausted — resetting session. " \
          "Original: #{e.message.lines.first&.strip}"
      end if defined?(Rails.logger)
      begin
        ReactOnRailsPro::Request.reset_connection
      rescue StandardError => reset_err
        Rails.logger.error do
          "[RORPStreamPoolLeakFix] reset_connection failed: #{reset_err.class}: #{reset_err.message}"
        end if defined?(Rails.logger)
      end
    end
    raise
  end

  def self.pool_timeout?(error)
    return true if defined?(HTTPX::PoolTimeoutError) && error.is_a?(HTTPX::PoolTimeoutError)
    return true if defined?(HTTPX::TimeoutError) && error.is_a?(HTTPX::TimeoutError) &&
                   error.message.to_s.include?("waiting for a connection")
    return true if defined?(ReactOnRailsPro::Error) && error.is_a?(ReactOnRailsPro::Error) &&
                   error.message.to_s.include?("PoolTimeoutError")
    false
  end
end

ReactOnRailsPro::StreamRequest.prepend(RORPStreamPoolHeal)

if ReactOnRailsPro.respond_to?(:configuration) && ReactOnRailsPro.configuration.respond_to?(:renderer_http_pool_size=)
  current = ReactOnRailsPro.configuration.renderer_http_pool_size
  if current.nil? || current < 20
    ReactOnRailsPro.configuration.renderer_http_pool_size = 20
  end
end

Rails.logger.info { "[RORPStreamPoolLeakFix] self-heal workaround active (issue shakacode/react_on_rails#3295)" } if defined?(Rails.logger)

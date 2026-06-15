# frozen_string_literal: true

# Application-level helper that adds a *cached* variant of
# `stream_react_component_with_async_props`.
#
# React on Rails Pro ships `cached_stream_react_component` (fragment-cache wrapper around the plain
# `stream_react_component` streaming path) but, as of 17.0.0.rc.3, there is no cached wrapper around
# `stream_react_component_with_async_props`. This helper fills that gap **for this demo app** so we
# can benchmark caching gains on the RSC pages that emit async props (see issue #97).
#
# It is NOT a copy of any proprietary gem code: it only orchestrates calls to the gem's public API
# (`stream_react_component_with_async_props`, `ReactOnRailsPro::Cache.*`) and to the same-object
# helper method `handle_stream_cache_hit` that the gem already mixes into this ActionView context.
#
# ---------------------------------------------------------------------------------------------------
# Why caching an async-props stream is sound
# ---------------------------------------------------------------------------------------------------
# `stream_react_component_with_async_props` differs from `stream_react_component` only in that it sets
# an `async_props_block`. Each `emit.call(section, data)` in that block is sent to the node renderer,
# which streams the resulting HTML back **as additional chunks in the same response stream**. The
# gem's `cached_stream_react_component` already collects *every* streamed chunk into an array (via the
# `on_complete` callback) and, on a subsequent request, replays that array. Because the async-emitted
# sections are just later chunks in that same stream, the captured array is the fully-resolved output
# of all sections. On a cache hit we replay those chunks directly — the async block (DB queries,
# `sleep`, node-renderer round-trips) never runs again.
#
# ---------------------------------------------------------------------------------------------------
# IMPORTANT — cache key completeness
# ---------------------------------------------------------------------------------------------------
# The cache key (`ReactOnRailsPro::Cache.react_component_cache_key`) is built from the component name,
# the gem/bundle versions, and YOUR `cache_key:` value — it does **not** include the props. Exactly
# like Rails fragment caching, the caller's `cache_key:` must encode every input that changes the
# rendered output: both the initial `:props` AND anything the async block emits (record ids,
# updated_at, content version, search params, …). Do NOT fold artificial timing (e.g. a demo
# `sleep`/delay) into the key — skipping that work on a hit is the whole point.
module ReactOnRailsProCacheHelper
  # Cached variant of `stream_react_component_with_async_props`.
  #
  # Same arguments as `stream_react_component_with_async_props` (the block is the async props block,
  # initial/sync props go in `:props`) with the fragment-caching additions of
  # `cached_stream_react_component`:
  #
  # 1. Provide `cache_key:` — String / Array / Proc, same semantics as Rails fragment caching. The
  #    server bundle digest is folded in automatically (prerender is always true for streaming).
  # 2. Optionally provide `cache_options:` (`:expires_in`, `:compress`, `:race_condition_ttl`).
  # 3. Optionally provide `:if` / `:unless` to conditionally enable caching.
  # 4. `:props` may be a Hash (evaluated eagerly by the view) OR a callable/Proc (evaluated lazily,
  #    only on a cache miss) so that nothing expensive runs on a hit.
  #
  # @example
  #   <%= cached_stream_react_component_with_async_props("BlogPostRSC",
  #         cache_key: ["blog_post_rsc", @post_meta[:id], @post_meta[:updated_at]],
  #         cache_options: { expires_in: 1.hour },
  #         props: { post: @post_meta }) do |emit|
  #         emit.call("post_content", { content: BlogData.find_post(@post_meta[:id])[:content] })
  #       end %>
  def cached_stream_react_component_with_async_props(component_name, raw_options = {}, &async_props_block)
    unless ReactOnRailsPro.configuration.enable_rsc_support
      raise ReactOnRailsPro::Error,
            'cached_stream_react_component_with_async_props requires enable_rsc_support to be true. ' \
            'Async props depend on React Server Components. ' \
            'Set `config.enable_rsc_support = true` in your ReactOnRailsPro configuration.'
    end

    ReactOnRailsPro::Utils.with_trace(component_name) do
      check_async_caching_options!(raw_options, async_props_block)
      fetch_cached_stream_async_props(component_name, raw_options, &async_props_block)
    end
  end

  private

  # Mirrors the gem's `check_caching_options!` but, unlike the plain cached helper, *allows* a
  # `:props` key — for async-props components the block is the async props block, not the props
  # source, so initial/sync props legitimately arrive via `:props`.
  def check_async_caching_options!(raw_options, block)
    if block.nil?
      raise ReactOnRailsPro::Error,
            'cached_stream_react_component_with_async_props requires the async props to be passed as a block'
    end

    return if raw_options.key?(:cache_key)

    raise ReactOnRailsPro::Error, "Option 'cache_key' is required for React on Rails caching"
  end

  # Cache-flow mirror of the gem's private `fetch_stream_react_component`, swapping the terminal
  # render call for the async-props variant.
  def fetch_cached_stream_async_props(component_name, raw_options, &async_props_block)
    auto_load_bundle = ReactOnRails.configuration.auto_load_bundle || raw_options[:auto_load_bundle]

    # Conditional caching (:if / :unless disabled) — stream live without touching the cache.
    unless ReactOnRailsPro::Cache.use_cache?(raw_options)
      return render_async_props_stream(component_name, raw_options, auto_load_bundle, nil, &async_props_block)
    end

    fetch_cached_stream_async_props_with_cache(component_name, raw_options, auto_load_bundle, &async_props_block)
  end

  def fetch_cached_stream_async_props_with_cache(component_name, raw_options, auto_load_bundle, &async_props_block)
    view_cache_key = stream_async_props_cache_key(component_name, raw_options)

    # HIT: replay the cached chunk array without evaluating props or running the async block.
    cached_chunks = Rails.cache.read(view_cache_key)
    if cached_chunks.is_a?(Array)
      log_stream_cache_event('HIT', component_name, view_cache_key, "(#{cached_chunks.size} chunks) ")
      # Reuse the gem's replay path. Props are irrelevant to chunk replay (load_pack only needs the
      # component name + auto_load_bundle), so strip them — this also keeps a lazy Proc from leaking
      # into RenderOptions on a hit.
      return handle_stream_cache_hit(component_name, raw_options.except(:props), auto_load_bundle, cached_chunks)
    end

    # MISS: stream live and write the full chunk array through to the cache once fully consumed.
    log_stream_cache_event('MISS', component_name, view_cache_key, '(rendering live) ')
    on_complete = cache_writethrough_callback(component_name, view_cache_key, raw_options)
    render_async_props_stream(component_name, raw_options, auto_load_bundle, on_complete, &async_props_block)
  end

  # prerender: true folds the server bundle digest into the key (matches the gem's stream caching).
  def stream_async_props_cache_key(component_name, raw_options)
    ReactOnRailsPro::Cache.react_component_cache_key(component_name, raw_options.merge(prerender: true))
  end

  def cache_writethrough_callback(component_name, view_cache_key, raw_options)
    lambda do |chunks|
      Rails.cache.write(view_cache_key, chunks, raw_options[:cache_options] || {})
      log_stream_cache_event('WROTE', component_name, view_cache_key, "(#{chunks.size} chunks) ")
    end
  end

  # Distinctive, greppable marker so stream caching is observable in the logs. The streamed cache does
  # NOT set RORP_CACHE_HIT (that flag is only populated on the Hash-returning react_component path), so
  # this log line is the intended way to confirm a hit/miss for cached_stream_react_component_with_async_props.
  def log_stream_cache_event(event, component_name, view_cache_key, detail = '')
    Rails.logger.info do
      "[RORP cached_stream_async_props] #{event} #{component_name} #{detail}key=#{view_cache_key.inspect}"
    end
  end

  # Resolves (possibly lazy) sync props and delegates to the gem's async-props streaming helper,
  # threading the write-through `on_complete` callback when caching.
  def render_async_props_stream(component_name, raw_options, auto_load_bundle, on_complete, &async_props_block)
    props = raw_options[:props]
    props = props.call if props.respond_to?(:call)

    options = raw_options.merge(
      props: props,
      prerender: true,
      skip_prerender_cache: true,
      auto_load_bundle: auto_load_bundle
    )
    # `stream_react_component` (called downstream) does `options.delete(:on_complete)` and forwards it
    # to `consumer_stream_async`, which collects + replays chunks and fires the callback only on a
    # fully-consumed stream (never caches a client-disconnected/partial stream).
    options[:on_complete] = on_complete if on_complete

    stream_react_component_with_async_props(component_name, options, &async_props_block)
  end
end

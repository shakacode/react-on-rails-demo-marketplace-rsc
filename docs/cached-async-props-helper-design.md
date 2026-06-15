# Design: `cached_stream_react_component_with_async_props` (issue #97)

Repo helper that combines whole-stream fragment caching (`cached_stream_react_component`)
with async section emits (`stream_react_component_with_async_props`).
Implemented **in this repo** (we hold a RoR Pro license), no gem modification, no copying of
proprietary gem source — only original orchestration code that calls the gem's public + (same-object)
private API.

Gem under review: `react_on_rails_pro 17.0.0.rc.3`
File: `app/helpers/react_on_rails_pro_helper.rb` (the gem's helper).

## Established facts (verified against gem source)

1. **`cached_stream_react_component` → `fetch_stream_react_component`** (helper, lines ~254, ~327):
   - Cache key: `ReactOnRailsPro::Cache.react_component_cache_key(name, opts.merge(prerender: true))`.
     Key = `[type, ReactOnRails::VERSION, ReactOnRailsPro::VERSION, bundle_hash(if prerender),
     deps_checksum, component_name, user_cache_key]`. **Props are NOT in the key** (cache.rb:83-98).
   - HIT: `Rails.cache.read(key)` returns an `Array` of chunks → `handle_stream_cache_hit`
     (loads pack, returns first chunk synchronously, async-enqueues the rest to `@main_output_queue`).
   - MISS: `handle_stream_cache_miss` wraps options with
     `on_complete: ->(chunks){ Rails.cache.write(key, chunks, cache_options) }`, then
     `render_stream_component_with_props` (`props = yield`; calls `stream_react_component`).

2. **Chunk capture** (`consumer_stream_async` / `process_stream_chunks`, lines ~471-539):
   - When `on_complete` is set, EVERY emitted chunk is pushed into `all_chunks`.
   - `on_complete.call(all_chunks)` runs **only if the stream is fully consumed**
     (client-disconnect/partial → `false` → no cache write). So we never cache a truncated stream.

3. **Async-emitted props become ordinary downstream stream chunks** (`request.rb`
   `render_code_with_incremental_updates`, lines ~90-129): `emit.call(section, data)` sends an NDJSON
   `updateChunk` to the node renderer, which streams back additional HTML chunks **in the same stream**.
   Therefore `all_chunks` already captures the fully-resolved, all-sections output.
   **=> Caching an async-props stream is sound; on a hit we replay all chunks WITHOUT re-running the
   async block (no DB work, no `sleep`, no node round-trip).**

4. **`stream_react_component_with_async_props`** (helper, line ~157): only difference from
   `stream_react_component` is `options[:async_props_block] = block`. Requires `enable_rsc_support`
   (✓ set in `config/initializers/react_on_rails_pro.rb`). Initial/sync props passed via `:props`.

5. **`load_pack_for_generated_component`** (ror helper.rb:411) reads only `auto_load_bundle` +
   `react_component_name` — **not props**. => safe to strip `:props` before the hit-path call.

## The core tension

- `cached_stream_react_component` **forbids** a `:props` key (`check_caching_options!` raises if
  `raw_options.key?(:props)`) because it sources props from the block.
- `stream_react_component_with_async_props` uses the block as the **async** props block, and passes
  initial/sync props via `:props` (e.g. `props: { post: @post_meta }`).

So the new helper must: (a) treat the block as the **async_props_block**; (b) **allow** a `:props`
option for initial/sync props; (c) still **require** `:cache_key`.

## Caveats to enforce / document

- **Cache-key completeness (critical):** props are NOT in the key, so the caller's `cache_key:` must
  encode every input that drives BOTH the sync props and the async-emitted data
  (e.g. record id + updated_at / content version). Standard Rails fragment-cache contract.
  The artificial `sleep`/`@content_delay` must NOT be in the key (it changes timing, not output —
  skipping it on a hit is the whole point of the demo).
- **Prop eval on hit:** a `:props` Hash literal is evaluated eagerly by ERB even on a hit. To allow
  truly skipping it, the helper will accept `props:` as **either a Hash (eager) or a callable/Proc
  (lazy, evaluated only on miss/uncached)**. The async block is never evaluated on a hit.

## Implementation plan

New file `app/helpers/react_on_rails_pro_cache_helper.rb`, module
`ReactOnRailsProCacheHelper`. Because Rails mixes all helpers into the same ActionView context as the
gem's `ReactOnRailsProHelper`, the new method can call the gem's same-object private methods
(`handle_stream_cache_hit`) and public methods (`stream_react_component_with_async_props`,
`ReactOnRailsPro::Cache.*`).

```ruby
module ReactOnRailsProCacheHelper
  def cached_stream_react_component_with_async_props(component_name, raw_options = {}, &async_props_block)
    unless ReactOnRailsPro.configuration.enable_rsc_support
      raise ReactOnRailsPro::Error, "...requires enable_rsc_support to be true..."
    end
    ReactOnRailsPro::Utils.with_trace(component_name) do
      check_async_caching_options!(raw_options, async_props_block)
      fetch_cached_stream_async_props(component_name, raw_options, &async_props_block)
    end
  end

  private

  def check_async_caching_options!(raw_options, block)
    raise ReactOnRailsPro::Error, "Pass the async props as a block" if block.nil?
    raise ReactOnRailsPro::Error, "Option 'cache_key' is required" unless raw_options.key?(:cache_key)
  end

  def fetch_cached_stream_async_props(component_name, raw_options, &async_props_block)
    auto_load_bundle = ReactOnRails.configuration.auto_load_bundle || raw_options[:auto_load_bundle]

    unless ReactOnRailsPro::Cache.use_cache?(raw_options)
      return render_async_stream(component_name, raw_options, auto_load_bundle, nil, &async_props_block)
    end

    key_options   = raw_options.merge(prerender: true)
    view_cache_key = ReactOnRailsPro::Cache.react_component_cache_key(component_name, key_options)

    cached_chunks = Rails.cache.read(view_cache_key)
    if cached_chunks.is_a?(Array)
      # Reuse the gem's replay path. Strip :props (irrelevant to chunk replay; load_pack ignores props)
      # so a lazy Proc never leaks into RenderOptions.
      return handle_stream_cache_hit(component_name, raw_options.except(:props), auto_load_bundle, cached_chunks)
    end

    on_complete = ->(chunks) { Rails.cache.write(view_cache_key, chunks, raw_options[:cache_options] || {}) }
    render_async_stream(component_name, raw_options, auto_load_bundle, on_complete, &async_props_block)
  end

  def render_async_stream(component_name, raw_options, auto_load_bundle, on_complete, &async_props_block)
    props = raw_options[:props]
    props = props.call if props.respond_to?(:call)   # lazy props supported

    options = raw_options.merge(
      props: props,
      prerender: true,
      skip_prerender_cache: true,
      auto_load_bundle: auto_load_bundle
    )
    options[:on_complete] = on_complete if on_complete

    stream_react_component_with_async_props(component_name, options, &async_props_block)
  end
end
```

Notes:
- `stream_react_component_with_async_props` sets `async_props_block`, then `stream_react_component`
  does `options.delete(:on_complete)` and passes it to `consumer_stream_async` → write-through works.
- I keep cache-only keys (`:cache_key`, `:cache_options`, `:if`, `:unless`) in the options passed
  downstream **for parity** with the gem's own `render_stream_component_with_props`, which does the
  same and is proven safe in production.
- Reusing the private `handle_stream_cache_hit` couples to this gem version; acceptable for a demo
  repo pinned to one version, and keeps hit-path behavior identical to `cached_stream_react_component`.

## Usage (step 3)

Add `*-cached` route variants for the three async-props pages (keep uncached routes as the benchmark
baseline): `/blog/rsc-cached`, `/product/rsc-cached`, `/product-search/rsc-cached`.
Each new controller action mirrors the existing one; the view calls
`cached_stream_react_component_with_async_props` with a deterministic `cache_key` and the same
`props:` + async block. Start with `/blog/rsc-cached` as the canonical demo, then fan out.

## Open questions for reviewer

1. Reuse gem-private `handle_stream_cache_hit` vs. inline a copy? (coupling vs. duplication)
2. Support lazy `props:` Proc, or keep parity with the eager `:props` Hash only?
3. Helper location/name: `app/helpers/react_on_rails_pro_cache_helper.rb` OK?
4. Should cache-only keys be stripped before the downstream render call, or kept for gem parity?

## Resolution (co-reviewed with Codex gpt-5.5 @ xhigh — all four steps AGREED)

- Design / Implementation / Usage-plan / Final-diff each reviewed; advanced only on mutual agreement.
- Q1: reuse gem-private `handle_stream_cache_hit` — accepted (demo pinned to one gem version; keeps
  hit-path behavior identical to `cached_stream_react_component`).
- Q2: support lazy `props:` Proc — accepted (strictly better; nothing expensive runs on a hit).
- Q3: `app/helpers/react_on_rails_pro_cache_helper.rb` — accepted.
- Q4: keep cache-only keys downstream for parity with the gem's own `render_stream_component_with_props`
  (proven safe). On the HIT path we additionally strip `:props` (irrelevant to replay; `load_pack`
  only needs component name + auto_load_bundle).

### Implemented
- Helper: `app/helpers/react_on_rails_pro_cache_helper.rb`.
- Used on: `/blog/rsc-cached` → `BlogController#post_rsc_cached` → `app/views/blog/post_rsc_cached.html.erb`
  (cached sibling of `/blog/rsc`; uncached route kept as the benchmark baseline).
- `cache_key: ["blog_post_rsc", @post_meta[:id]]` (static demo content varies only by id; the
  simulated delays are deliberately NOT in the key).

### Verification caveat (for the benchmark step)
`RORP_CACHE_HIT` is set only on the Hash-returning `react_component` cache path, NOT on this view-level
*stream* chunk cache. To prove a hit on the streamed pages, use **timing** (a hit skips the
`CONTENT_DELAY_MS` + `sleep 1.5` and the node-renderer round-trip), a **log line**, or **`Rails.cache`
key inspection**. This is itself a data point for the issue's "is the cache hit actually exercised?"
investigation. Optional follow-up: add a `Rails.logger.info`/debug hit-vs-miss marker in the helper.

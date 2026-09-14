# RSC read-your-writes: refetching a streamed async-props page after a Rails mutation

Findings doc for the spike phase of
[#245](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/245).
Every conclusion below cites either a running-demo artifact under
`tmp/spike-245-evidence/` (regenerate with the commands in
[Reproducing](#reproducing)) or an exact file:line in this repo or in the
installed `react_on_rails` / `react_on_rails_pro` **17.0.1** packages.

**Environment for all evidence:** development mode (Rails dev server on :3000,
`node node-renderer.js` on :3800, development webpack bundles). This matters
because `RSCRoute` treats refetch failures differently by design: outside
production it rethrows loudly through the route; in production the last good
content stays visible and `refetchError` is set
(`node_modules/react-on-rails-pro/lib/RSCRoute.d.ts`, handle docstring). Every
crash described below is therefore the loud dev-mode presentation of a failure
that production would surface as `refetchError` + stale-but-intact content.

## The experiment

A `'use client'` island (`app/javascript/components/product/ReviewMutationIsland.tsx`)
with a single button — deliberately not a form, so #244's form-library question
stays uncontaminated — does two things:

1. `POST /products/:product_id/reviews` (`app/controllers/product_reviews_controller.rb`,
   201 JSON on success, `render_model_errors` 422 shape on invalid input);
2. `useCurrentRSCRoute().refetch()` inside an async `useTransition`, asking the
   enclosing `<RSCRoute>` (which `registerServerComponent` wraps around every
   RSC page) to re-render `/product/rsc`'s server-component tree.

Three configurations were executed, each with browser console + network +
renderer-log capture and full-page screenshots (Puppeteer;
`tmp/spike-245-evidence/run-spike-probe.mjs`).

| Config | Template | RSC cache | Result |
|---|---|---|---|
| 1 | stock gem `rsc_payload` template | off | write saved, refetch renders **without** `getReactOnRailsAsyncProp` → every async section errors in-stream → dev-mode page crash |
| 2 | app override + shared emitter | off | **works end to end** — new review visible with no navigation; island state + scroll survive |
| 3 | app override + shared emitter | `RSC_CACHE_ENABLED=true` | second wall first (`BUILD_ID not set`, worker-dependent); once past it, refetch is **fresh, not stale** on this push-mode page — but pull-mode staleness is real and demonstrated |

## Conclusions

### C1 — Does `useCurrentRSCRoute().refetch()` work from a client island inside a `stream_react_component_with_async_props` page?

**Works-only-with-app-code.** Stock: no (C2). With the one-file template
override plus the shared emitter service (C3/C4): yes, end to end. Evidence:
`tmp/spike-245-evidence/config2-override/findings.json` — step `after-click`
shows the just-posted reviewer (`Spike Bot 16:27:01`, review id 519554 returned
by the POST) at the top of the rendered list on the same URL with zero console
errors/warnings (`console.log.json` for that run contains neither).

### C2 — Exact stock failure mode (the minimal reproducer)

Mechanism, verified at every layer:

- `refetch()` GETs `/rsc_payload/ProductPageRSC?props=<original componentProps>`.
- The gem's template for that endpoint is one line calling the **plain**
  `rsc_payload_react_component`
  (`react_on_rails_pro-17.0.1/app/views/react_on_rails_pro/rsc_payload.text.erb`),
  which passes no `async_props_block`.
- Without that block the renderer never injects the async-prop getter:
  `async_props_setup_js` returns `""` unless the block is present
  (`react_on_rails_pro-17.0.1/lib/react_on_rails_pro/server_rendering_js_code.rb:95`),
  so `addAsyncPropsCapabilityToComponentProps` never runs and
  `props.getReactOnRailsAsyncProp` simply does not exist.

Observed (config 1, `tmp/spike-245-evidence/config1-stock/`):

- `POST /products/1/reviews` → **201** `{"id":519553}` — the write itself is fine.
- `GET /rsc_payload/ProductPageRSC?...` → **HTTP 200**, 112,104-byte NDJSON
  stream whose shell chunk says `"hasErrors":false,"isShellReady":true` — there
  is no HTTP-level failure to detect.
- Renderer log: four separate
  `TypeError: getReactOnRailsAsyncProp is not a function`, one per async
  section (`AsyncProductDetailsRSC.tsx`, `AsyncReviewStatsRSC.tsx`,
  `AsyncReviewsRSC.tsx`, `AsyncRelatedProductsRSC.tsx`), each at its
  `await getReactOnRailsAsyncProp(...)` line (`renderer.log`).
- Browser: four `[SERVER] Error in RSC stream`, then
  `ServerComponentFetchError: getReactOnRailsAsyncProp is not a function`
  rethrown through `RSCRouteErrorBoundary.render` (dev mode), React unmounts
  the tree, and the page goes blank (`after.png`; `findings.json` step
  `after-click`: `islandPresent: false`, `reviewersVisible: []`).

**Classification:** at the wire level a *half-render* (shell fine, per-boundary
errors inside the stream); user-visibly in development a *loud crash* of the
whole page. Production would keep last-good content and set `refetchError`
instead (by design, per the RSCRoute docstring) — meaning the user's write
silently never appears.

### C3 — Is the documented escape hatch sufficient, or is there a second wall?

**The template override is sufficient for the uncached path — and there IS a
second wall behind it when the JS-side RSC cache is on.**

The fix that makes config 2 pass is app-level only:

- `app/views/react_on_rails_pro/rsc_payload.text.erb` shadows the engine
  template by plain Rails view-path precedence (the engine has no
  `isolate_namespace`), dispatches `ProductPageRSC` through
  `rsc_payload_react_component_with_async_props`
  (`react_on_rails_pro-17.0.1/app/helpers/react_on_rails_pro_helper.rb:206`)
  with an emit block, and keeps the stock plain-props call for every other
  component. No new controller, no route change — `rsc_payload_route` in
  `config/routes.rb` is untouched.
- Two practical traps hit while building it, both worth documenting upstream:
  the template must stay `.text.erb` (`RSCPayloadRenderer` renders
  `formats: [:text]` and raises a bespoke `MissingTemplate` otherwise), and the
  template must be whitespace-clean — the response is a length-prefixed NDJSON
  stream, and even an ERB *comment* containing a literal close sequence
  truncates it (this exact bug produced a 3KB corrupt stream on the first
  attempt; fixed by trimming every tag).

**The second wall (config 3):** with `RSC_CACHE_ENABLED=true`, the refetch
crashed with

> `Error: BUILD_ID not set. Ensure unstable_cache is used within a React Server
> Component render context. The BUILD_ID is initialized from rscBundleHash
> during the first render request.`

(`tmp/spike-245-evidence/config3-cache/workers2-buildid-crash/{console.log.json,at-probe-error.png,renderer.log}`).
Mechanism, from source:

- `setBuildId` runs only when
  `railsContext.serverSideRSCPayloadParameters?.rscBundleHash` is present
  (`node_modules/react-on-rails-pro/lib/capabilities/proRSC.js:73`).
- Those parameters are attached only on the page-render path — the SSR bundle's
  `generateRSCPayload` prelude sets them
  (`react_on_rails_pro-17.0.1/lib/react_on_rails_pro/server_rendering_js_code.rb:52`);
  the payload-endpoint path (`rsc_payload_streaming?`, same file line 34)
  deliberately installs a throwing `generateRSCPayload` stub and sets nothing.
- So a renderer worker's RSC context gets a BUILD_ID **only after that worker
  has served a page render**. The default config runs 2 workers
  (`node-renderer.js`): the initial page load initialized worker A, the refetch
  landed on worker B → crash. Re-running the identical click with
  `RENDERER_WORKERS_COUNT=1`
  (`.../config3-cache/workers1/findings.json`) succeeded — worker roulette,
  not app code.

There is no clean app-level fix for this one (the provider is package-internal
state); it needs an upstream change — initialize BUILD_ID on the payload path
too (the Rails side already knows `rsc_bundle_hash`).

### C4 — What does a refetchable async-props page cost the app developer, and where should the emit block live?

Three files, one of them shared infrastructure:

1. **`app/views/react_on_rails_pro/rsc_payload.text.erb`** (new, once per app)
   — generic: one template serves every component, dispatching by
   `@rsc_payload_component_name`. Per-page cost inside it is one branch that
   reconstructs data from the browser-supplied props and calls the page's
   emitter.
2. **`app/services/product_rsc_props.rb`** (new, once per async-props page) —
   the emit block extracted out of the view so door #1
   (`app/views/products/show_rsc.html.erb`, now a 3-line block) and door #2
   share one source. This is where the block should live: a plain service
   object keyed by page, reusing the existing `ProductSerialization` shapes.
   Request specs pin both doors to it
   (`spec/requests/product_reviews_spec.rb`).
3. The island itself (`ReviewMutationIsland.tsx` + the 3-line `...ForServer.tsx`
   re-export) — but any mutation UI needs *some* client code; the refetch part
   is two lines (`useCurrentRSCRoute().refetch()` in a transition).

So: **one generic payload template can serve every async-props page**, and the
per-page marginal cost is (a) an emitter service the page view wants anyway and
(b) a dispatch branch. Two caveats that belong in any upstream recipe:

- **Props come from the browser.** `@rsc_payload_component_props` is
  `JSON.parse(params[:props])`
  (`react_on_rails_pro-17.0.1/lib/react_on_rails_pro/concerns/rsc_payload_renderer.rb:64`)
  — string keys, client-controlled values. The override must treat them as
  untrusted input (here: only `product.id` is read, and only public catalog
  data is emitted). 17.1 adds `rsc_payload_authorizer` for exactly this seam.
  Related sharp edge: the page renders hero/name/price from those
  browser-supplied props as-is; hand-crafting a minimal `?props={"product":
  {"id":1}}` request crashes in `buildProductSpecMarkdown` because `sku` is
  missing — the door assumes the full original prop shape.
- The upstream ask this implies: the *recipe* is documentable today (this repo
  is the demo), but first-class support would mean the gem letting an app
  register `component_name → emitter` (or a controller-level hook) instead of
  template shadowing, plus the BUILD_ID fix from C3.

### C6 — Can a successful refetch still return stale content?

**Not on this (push-mode) page — and the reason is precise. The staleness is
real, but it lives exactly where the cache actually saves work.**

`unstable_cache`'s key hashes the cached function's **arguments**:
`buildCacheKey(buildId, id, args)`
(`node_modules/react-on-rails-pro/lib/cache/buildCacheKey.js:90`; options are
TTL-only — `{ id, revalidate = 0, kind }`, `.../cache/unstable_cache.js:42` —
no tags, no delete). On `/product/rsc`, Rails re-runs the emit block on every
refetch and the fresh rows are *passed into* the cached components
(`CachedReviewsList({ reviews })`, `CachedReviewStats({ distribution, ... })`),
so a write changes the args, the key misses, and the user sees their review:
`config3-cache/workers1/findings.json` shows the new reviewer first in the list
after both clicks — including the one *inside* the 60-second revalidate window.
Corollary: on this page shape the cache also **cannot save the Rails queries**;
it only memoizes React rendering for unchanged data.

Where the cache *does* skip the data fetch, the stale read is real and
demonstrated (`config3-cache/pull-mode-staleness/`): on `/product/rsc-pull`,
the cached component is keyed by `{ productId }` and calls
`getAsyncProp('reviews')` *inside* the cached function
(`app/javascript/components/product/AsyncReviewsPullRSC.tsx`):

| time (UTC) | action | result |
|---|---|---|
| 16:42:14 | load `/product/rsc-pull` | primes `pull-product-reviews` for `{productId: 1}` |
| 16:42:25 | Rails write (review 519561, "Pull Stale Probe") | committed |
| 16:42:33 | reload `/product/rsc-pull` (8s after write, inside TTL) | **review absent** — cache HIT, prop never pulled, Rails never queried (`load2-within-ttl.html`: 0 matches) |
| 16:42:33 | load `/product/rsc` (push page, same instant) | review present (fresh query) — proves the write is visible |
| 16:43:35 | reload `/product/rsc-pull` (past the 60s revalidate) | review present (`load3-after-ttl.html`: 1 match) — TTL expiry is the only recovery |

So the correctness statement for the issue: **refetch is not the gap; write-time
invalidation of the JS-side RSC component cache is.** A write can neither
target (no tags) nor delete (no `delete()`) a renderer-cache entry — Rails'
own fragment-cache path has exactly this
(`cache_tags:` + `ReactOnRailsPro.revalidate_tag`), the JS-side cache does not.
Server functions would not change this either; the missing piece is
`revalidateTag`-style tagging on `unstable_cache`.

### C7 — What survives a refetch?

From `config2-override/findings.json` and `config3-cache/workers1/findings.json`
(identical behavior in both):

- **Unrelated client-island state survives.** `AddToCartSection` quantity was
  set to 3 before the click and read 3 after every refetch (steps
  `after-qty-bump` → `after-click` → `after-second-click`).
- **Scroll position survives.** `scrollY` 3524 before the click, 3524 after
  (the config-1 crash, by contrast, reset it to 0 along with the page).
- **No fallback flash.** `skeletonCount` stayed 0 through every refetch — old
  content remained visible until the new tree swapped in, i.e. `useTransition`
  wraps `refetch()` cleanly and provides the pending flag the handle itself
  lacks (button shows "Refreshing page…" while `isPending`).
- Not measured (out of spike scope): focus restoration, CLS numbers.

## Reproducing

```bash
# build (configs 1-2: cache off; config 3: RSC_CACHE_ENABLED=true)
bundle exec rake react_on_rails:generate_packs
bin/shakapacker --mode development                        # configs 1-2
RSC_CACHE_ENABLED=true bin/shakapacker --mode development # config 3

# run (single renderer worker avoids the C3 BUILD_ID worker roulette)
RENDERER_WORKERS_COUNT=1 node node-renderer.js &
bundle exec rails server -p 3000 &

# probe (writes findings.json, console/network logs, screenshots)
node tmp/spike-245-evidence/run-spike-probe.mjs tmp/spike-245-evidence/<outdir> \
  [--second-click-after-ms 70000]
```

Config 1 = check out the commit before the template override (or delete
`app/views/react_on_rails_pro/rsc_payload.text.erb`). The request-spec half of
the evidence runs with plain
`bundle exec rspec spec/requests/product_reviews_spec.rb`.

## Follow-ups this implies (not in this PR)

1. Upstream issue: the default `rsc_payload` template cannot serve async-props
   pages — C2's reproducer, plus the recipe from C3/C4 (or first-class
   `component_name → emitter` registration).
2. Upstream issue: BUILD_ID is never initialized on the RSC payload endpoint
   path, so `unstable_cache` + `refetch()` crashes per worker until that worker
   serves a page render (C3's second wall).
3. Upstream issue/RFC: `unstable_cache` needs write-time invalidation (tags /
   delete) — C6; this is the piece server functions would not have fixed.
4. `docs/oss/building-features/mutations.md` "after the write" row should list
   `RSCRoute.refetch()` once 1-2 land.

Draft texts for these live in `tmp/spike-245-evidence/drafts/`.

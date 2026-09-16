# RSC read-your-writes: refetching a streamed async-props page after a Rails mutation

Findings doc for the spike phase of
[#245](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/245).
Every conclusion below cites either a running-demo artifact under
`tmp/spike-245-evidence/` (regenerate with the commands in
[Reproducing](#reproducing)) or an exact file:line in this repo or in the
installed `react_on_rails` / `react_on_rails_pro` **17.0.1** packages.

**Environment for the spike evidence (C1-C4, C6, C7):** development mode
(Rails dev server, `node node-renderer.js`, development webpack bundles). The
follow-up evidence under `tmp/spike-245-evidence/followup/` adds
production-mode runs (production rspack bundles, `RAILS_ENV=production`,
`NODE_ENV=production` renderer) for C8, and dev-mode runs for C5/C9.

`RSCRoute` treats refetch failures differently by design: outside production
it rethrows loudly through the route; in production the docstring says the
last good content stays visible and `refetchError` is set
(`node_modules/react-on-rails-pro/lib/RSCRoute.d.ts`, handle docstring). C8
below tests that claim for real, and it holds **only for fetch-level
failures** (HTTP error / network); the mid-stream per-boundary failure class
that C2 describes crashes the page in production too — see C8 for the
artifacts.

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
whole page. The spike predicted production would keep last-good content and
set `refetchError` instead (per the RSCRoute docstring); **C8a executed that
prediction and it is wrong for this failure class** — production blanks the
page too, with digest-sanitized messages and no `refetchError`
(`tmp/spike-245-evidence/followup/c8a-prod/broken/`).

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

Four pieces, two of them once-per-app infrastructure (the spike's first
draft said "three files"; the merged recipe grew a controller in the
security pass, so the honest count is below):

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
3. **`app/controllers/rsc_payload_controller.rb`** (new, once per app) —
   subclasses the gem's payload controller via
   `rsc_payload_route(controller: "rsc_payload")`. The template cannot set a
   status once the NDJSON stream has started, so browser-supplied `?props=`
   validation lives in a `before_action`: bracket-notation props → 400 for
   any component, missing/unknown/non-scalar product id → 404 before any
   chunk is emitted.
4. The island itself (`ReviewMutationIsland.tsx` + the 3-line `...ForServer.tsx`
   re-export) — but any mutation UI needs *some* client code; the refetch part
   is two lines (`useCurrentRSCRoute().refetch()` in a transition). Door #1's
   view also shrank to a 3-line block that calls the shared emitter.

So: **one generic payload template can serve every async-props page**, and the
per-page marginal cost is (a) an emitter service the page view wants anyway and
(b) a dispatch branch. Two caveats that belong in any upstream recipe:

- **Props come from the browser.** `@rsc_payload_component_props` is
  `JSON.parse(params[:props])`
  (`react_on_rails_pro-17.0.1/lib/react_on_rails_pro/concerns/rsc_payload_renderer.rb:64`)
  — string keys, client-controlled values. The override must treat them as
  untrusted input (here: only `product.id` is read, and only public catalog
  data is emitted). 17.1 adds `rsc_payload_authorizer` for exactly this seam.
  Related sharp edge (observed, then hardened in this PR): the page renders
  hero/name/price from those browser-supplied props as-is, and at evidence
  time a hand-crafted minimal `?props={"product":{"id":1}}` request crashed in
  `buildProductSpecMarkdown` because `sku` was missing — the door assumed the
  full original prop shape. The override now reads ONLY the product id,
  responds 404 for a missing/unknown id before any chunk is emitted, and
  rebuilds the initial props server-side via `ProductRscProps.initial_props`
  (same shape door #1's controller builds), so the browser's copy is never
  echoed. Request specs pin both behaviors.
- The upstream ask this implies: the *recipe* is documentable today (this repo
  is the demo), but first-class support would mean the gem letting an app
  register `component_name → emitter` (or a controller-level hook) instead of
  template shadowing, plus the BUILD_ID fix from C3.

### C5 — Can a refetch be scoped to just the reviews section, and what does narrowing cost?

**Yes — a nested `<RSCRoute>` scopes both the refetch and its blast radius,
strictly, in both directions.** Executed on `/product/rsc` with
`ProductReviewsSectionRSC`, a server component wrapping ONLY the reviews
section (stats + list + its own island), mounted inside `ProductPageRSC`
through `<RSCRoute componentName="ProductReviewsSectionRSC"
componentProps={{product_id, review_mutation_enabled}}>` and gated behind
`ENABLE_SPIKE_MUTATIONS` so every other variant renders an unchanged tree.

Measured (`tmp/spike-245-evidence/followup/c5-section/probe1/findings.json`,
corroborated by the C9 lanes):

- **Payload size:** a section refetch streams **87,229 bytes** where the
  whole-page refetch streams **239,493 bytes** (development mode; the same
  click in production-mode C8a moved 69,158 bytes for the whole page, so dev
  numbers overstate both absolutes).
- **Blast radius:** hashing the `outerHTML` of every direct child of the page
  container before/after, only the reviews `<section>` (child index 6)
  changed; hero grid, breadcrumb, product details, related products, and the
  spec sheet hashed identical. `AddToCartSection` quantity (3) and scroll
  position survived; skeleton count stayed 0 (no fallback flash).
- **`useCurrentRSCRoute()` resolves to the NEAREST route — verified.** The
  island instance inside the nested route refetched only
  `/rsc_payload/ProductReviewsSectionRSC`; the identical component mounted at
  page scope kept refetching `/rsc_payload/ProductPageRSC`.
- **Scoping is strict in both directions, and that is the sharp edge.** A
  section refetch leaves the inline copy of the same data untouched, and a
  whole-page refetch leaves the nested route's subtree untouched: the nested
  `<RSCRoute>`'s payload cache key (`createRSCPayloadKey(name, props)`) does
  not change when its parent re-renders, so the provider serves the cached
  section payload (`c5-section/probe1`: `nestedListAlsoUpdated: false` after
  the page click; C9 lane D: `inlineListAlsoUpdated: false`). Anything
  outside the route that reflects the same write (a header review-count, a
  stats badge elsewhere) goes stale with no supported cross-route
  invalidation — the same missing-invalidation shape as C6, one layer up.

What narrowing costs the app developer, beyond C4's whole-page recipe:

1. The section server component + its `startup/` registration
   (`ProductReviewsSectionRSC.tsx` ×2) so the RSC bundle can render it by
   name for both doors.
2. **An app-level `'use client'` wrapper for the mount** (`ReviewsSectionRoute`
   in `ReviewMutationIsland.tsx`) — this is not a convenience but a hard
   requirement, discovered two ways. Build-time: a server component importing
   `react-on-rails-pro/RSCRoute` directly fails the RSC-bundle build —
   `react-on-rails-rsc/WebpackLoader` throws `SyntaxError: Unexpected token
   '/', "/* * Copy"... is not valid JSON` on
   `node_modules/react-on-rails-pro/lib/RSCRoute.js`
   (`tmp/spike-245-evidence/followup/c5-section/direct-import-build-error.log`).
   Manifest-level: both client-reference manifests are built by scanning
   `app/javascript` only (`config/rspack/serverRspackConfig.js`
   `rspackDefaultClientReferences`, `config/webpack/rscClientReferences.js`),
   so `public/packs/react-client-manifest.json` carries 65 entries, all under
   `app/javascript`, none for RSCRoute — a node_modules client reference
   could not be resolved even if it built.
3. A payload-template branch + a `RscPayloadController` case for the new
   component's props shape (`{product_id}` vs `{product: {id}}`), plus the
   narrow emitter (`ProductRscProps.emit_reviews_section` — reuses the same
   private builders as `emit_all`, so no duplicated row shapes).
4. Cache-key cardinality: the nested mount adds one provider-LRU key per
   distinct `componentProps` value — here `{product_id,
   review_mutation_enabled}`, i.e. one per product page, two keys total on
   this page against the 50-entry per-provider cap
   (`RSC_PAYLOAD_CACHE_MAX_ENTRIES`,
   `node_modules/react-on-rails-pro/lib/RSCProviderCache.js:40`). Cardinality
   only becomes a real cost if `componentProps` embed high-cardinality values
   (filters, cursors), which also multiply door requests.

One mechanism note that makes the initial render cheap: during SSR the nested
route's payload is generated through the SAME rendering request as the page
(`generateRSCPayload` swaps the component name/props into the request and
reruns it on the RSC bundle —
`react_on_rails_pro-17.0.1/lib/react_on_rails_pro/server_rendering_js_code.rb:52`),
so `getReactOnRailsAsyncProp` inside the section resolves from the page's ONE
emit block, and the section's payload is embedded in the HTML under its own
key (visible in the served page as
`REACT_ON_RAILS_RSC_PAYLOADS["ProductReviewsSectionRSC-…"]`). No extra Rails
request happens until someone actually refetches the section.

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

### C8 — Failure and concurrency behavior, verified in production mode

All C8 evidence is production-mode (production rspack bundles,
`RAILS_ENV=production` + `SECRET_KEY_BASE` + `RAILS_SERVE_STATIC_FILES=1`
against the dev database, `NODE_ENV=production` renderer,
`RENDERER_WORKERS_COUNT=1`), under `tmp/spike-245-evidence/followup/c8a-prod/`.
The happy path there is also the first production capture of the merged
mechanism at all: click → POST 201 → `GET /rsc_payload/ProductPageRSC` 200 at
**69,158 bytes** (vs 239,493 in dev) → new reviewer first in the list, island
quantity and scroll intact, zero console errors (`happy/findings.json`).

The docstring claim — "in production the last good content stays visible and
`refetchError` is set" — splits in two when executed:

- **Fetch-level failures: the claim HOLDS, exactly as written.** With the
  door answering 503 (induced via CDP request interception — the same shape
  as a dead upstream or proxy), the page kept every pixel of last-good
  content, the island rendered its `refetchError` box ("Failed to fetch RSC
  payload for component \"ProductPageRSC\" … HTTP 503"), and once the
  "upstream" recovered, the box's Retry re-fetched (200, 68,991 bytes) and
  swapped the fresh list in (`httpfail/findings.json`, steps `after-click` →
  `after-retry`).
- **Mid-stream per-boundary failures (C2's class): the claim DOES NOT HOLD.**
  With door #2 temporarily serving the stock gem template (app override
  `mv`-ed aside, restored immediately after the probe), the refetch response
  is HTTP 200 and the renderer logs the same four
  `getReactOnRailsAsyncProp is not a function` TypeErrors as dev
  (`broken/renderer-errors.log`) — but the browser tears the page down:
  visible text collapsed from 9,632 to 2,557 characters, hero/island/reviews
  all unmounted, **no** `refetchError`, only digest-sanitized "An error
  occurred in the Server Components render" messages and an uncaught
  `ServerComponentFetchError` page error (`broken/findings.json`,
  `broken/console.log.json`). Restoring the door does not help the open page
  — with the island unmounted there is no Retry to click
  (`retryClicked: false`); the only user recovery is a full reload.
  Mechanism: the refetch promise RESOLVES (the stream is 200 with errors
  inside), so `RSCRoute`'s recovery path — which wraps only the fetch
  promise — never runs; the per-boundary errors surface during the
  transition render, `RSCRouteErrorBoundary.render` rethrows them as
  `ServerComponentFetchError` (`lib/RSCRoute.js`), and nothing above catches.

So the operative failure-mode summary for a production app: an unreachable
or erroring door degrades gracefully; a door that streams a *broken payload*
(the exact thing the stock template does to an async-props page) takes the
whole page down in production too. That upgrades the C2 finding from "bad
dev-mode DX" to "production-visible failure", and adds an upstream ask:
per-boundary refetch errors should be recoverable (or at least catchable)
the way fetch-level errors already are.

**C8b — double-submit:** two programmatic `.click()`s 50 ms apart on the
island's button produced exactly ONE `POST /products/1/reviews` in the
network log, in both C9 runs (`c9-race/findings.json` and
`c9-race/run2/findings.json`, `c8b_double_click.postCount: 1`). The island's
synchronous in-flight ref (`postInFlightRef`) closes the gap before React
re-renders the disabled state, so the docstring's concurrent-refetch caveat
("only the most-recent cache write wins") stays unreachable from this UI.

### C9 — The read-your-writes race: measured cost per strategy

Same action — "post a canned review, then see it" — through four lanes on
`/product/rsc`, dev servers, RSC cache off, fresh page per lane
(`tmp/spike-245-evidence/followup/run-race-probe.mjs`; results
`c9-race/findings.json`, corroborating second run `c9-race/run2/`). Bytes are
CDP `encodedDataLength` summed over every request in the lane window (for
lane A that is the entire reload — that IS its cost); time is harness-clock
ms from the `POST /reviews` response to the new reviewer visible in the DOM
(mutation-polled). Lane B is probe-only: the RSC page has no client-patch
island, so it measures the POST plus the two JSON fetches a patch would need
(`/api/products/1/reviews` + `/review_stats`, both returned the new reviewer
— fresh queries), with render cost approximated by one rAF; treat it as a
lower bound.

| lane | ms POST→visible (run1 / run2) | bytes on wire | requests | scroll | island state |
|---|---|---|---|---|---|
| A — full reload (`location.reload()`) | 576 / 669 | 652,950 | 26 | lost¹ | lost (qty 3→1) |
| B — client JSON patch (probe-only) | 39 / 29 | 5,723 | 3 | kept | kept |
| C — `RSCRoute.refetch()` whole page | 194 / 191 | 242,141 | 2 | kept | kept |
| D — section refetch (C5's nested route) | 129 / 149 | 88,813 | 2 | kept | kept |

¹ Chromium's scroll restoration fired but landed 3,110 px away from the
pre-click position while the reload was still streaming — effectively lost.

Dev-mode caveat: absolute numbers shrink in production (lane C's payload
measured 69,158 bytes there, C8a happy run) but the ORDERING and the
state-survival column are the finding, and those are environment-independent.

**Decision rule:**

- **Client JSON patch when** the page is already client-rendered (the
  `/product/client` variant) or the write's visible delta is one small,
  locally-owned widget: ~40× fewer bytes and ~5× lower latency than a page
  refetch — but you hand-maintain a second copy of the render logic, and on
  an RSC page that means re-implementing server-rendered markup client-side,
  which is exactly the duplication RSC exists to remove.
- **Section refetch when** one route-wrapped section owns everything the
  write changes, and the page carries heavy unrelated content: 2.7× fewer
  bytes than whole-page at comparable latency — and accept C5's strictness
  (nothing outside the route updates, ever).
- **Whole-page refetch when** several sections reflect the write (here:
  stats, list, and potentially related products) — zero bespoke data
  plumbing beyond C4's recipe, all client state survives. This is the sane
  default for streamed RSC pages, at roughly a third of a full reload's
  bytes and none of its state loss.
- **Full navigation when** the write changes navigation-level context
  (redirect to a new resource, auth change) or you were leaving the page
  anyway. For an in-place mutation it is strictly the worst row of the
  table: every byte of the page again, plus every island reset.

## Reproducing

```bash
# build (configs 1-2: cache off; config 3: RSC_CACHE_ENABLED=true)
bundle exec rake react_on_rails:generate_packs
bin/shakapacker --mode development                        # configs 1-2
RSC_CACHE_ENABLED=true bin/shakapacker --mode development # config 3

# run (single renderer worker avoids the C3 BUILD_ID worker roulette;
# ENABLE_SPIKE_MUTATIONS=1 arms the gated write endpoint + island — never set in production)
RENDERER_WORKERS_COUNT=1 node node-renderer.js &
ENABLE_SPIKE_MUTATIONS=1 bundle exec rails server -p 3000 &

# probe (writes findings.json, console/network logs, screenshots)
node tmp/spike-245-evidence/run-spike-probe.mjs tmp/spike-245-evidence/<outdir> \
  [--second-click-after-ms 70000]
```

Config 1 = check out the commit before the template override (or delete
`app/views/react_on_rails_pro/rsc_payload.text.erb`). The request-spec half of
the evidence runs with plain
`bundle exec rspec spec/requests/product_reviews_spec.rb`.

Ports are env-driven throughout: pass `-p <port>` to `rails server`, set
`RENDERER_PORT` for the renderer and `RENDERER_URL` for Rails, and point the
probes with `SPIKE_BASE_URL` (the follow-up evidence was captured on
3100/3810 because 3000/3800 were in use).

Follow-up probes (C5, C8, C9 — scripts live next to the evidence):

```bash
# C5 section refetch + cross-scope staleness (dev servers as above)
SPIKE_BASE_URL=http://localhost:3100   node tmp/spike-245-evidence/followup/run-c5-probe.mjs   tmp/spike-245-evidence/followup/c5-section/probe1

# C9 four-lane race + C8b double-click (dev servers as above)
SPIKE_BASE_URL=http://localhost:3100   node tmp/spike-245-evidence/followup/run-race-probe.mjs   tmp/spike-245-evidence/followup/c9-race

# C8a production mode: build + run production servers first
SECRET_KEY_BASE=dummy_secret_key_base_for_demo_fleet bin/build-production
# (renderer: NODE_ENV=production RENDERER_WORKERS_COUNT=1 node node-renderer.js;
#  rails: RAILS_ENV=production + SECRET_KEY_BASE + ENABLE_SPIKE_MUTATIONS=1 +
#  RAILS_SERVE_STATIC_FILES=1, DATABASE_NAME/DATABASE_USERNAME at the dev DB)
node tmp/spike-245-evidence/followup/run-c8a-probe.mjs <outdir> --phase happy
node tmp/spike-245-evidence/followup/run-c8a-probe.mjs <outdir> --phase httpfail
# --phase broken: mv the payload template aside, restart rails, run the probe,
# restore the template + restart, touch the --resume-marker file it waits on.

# The e2e journey (seeds its own scenario, arms ENABLE_SPIKE_MUTATIONS itself)
e2e/run-playwright e2e/playwright/e2e/product_review_mutation.spec.ts
```

## Follow-ups (all upstream reports now filed)

1. shakacode/react_on_rails#5075 — the default `rsc_payload` template cannot
   serve async-props pages (C2's reproducer + the C3/C4 recipe, plus the
   bracket-notation TypeError and the template-cannot-404 lessons).
2. shakacode/react_on_rails#5076 — BUILD_ID never initialized on the RSC
   payload endpoint path (C3's second wall; worker roulette under cache).
3. shakacode/react_on_rails#5077 — `unstable_cache` needs write-time
   invalidation (tags / delete) — C6; the piece server functions would not
   have fixed either.
4. shakacode/react_on_rails#5078 — production refetch recovery covers only
   fetch-level failures (C8a); includes the poisoned last-successful-cache
   trap (`RSCProvider.js:441`) any fix must handle first.
5. shakacode/react_on_rails#5079 — the RSC bundle build fails on the
   package's own `'use client'` files (C5's build failure; sourcemap-pointer
   root cause proven by counterfactual).
6. Still open: `docs/oss/building-features/mutations.md` "after the write"
   row should list `RSCRoute.refetch()` once #5075 lands (or the recipe is
   blessed as-is).

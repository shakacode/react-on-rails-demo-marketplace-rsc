# react-virtuoso × RSC Benchmark — does list virtualization compose with RSC, and at what cost?

Issue: [#184 — Investigate react-virtuoso in the demo](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/184)

Branch: `184-investigate-react-virtuoso-in-the-demo-does-list` | Stack: React on Rails 17.0.0, react-virtuoso 4.18.12, React 19.2.8 | Date: 2026-08-27

**Verdict: they compose — mechanically cleanly, economically only past a
threshold this page's default size sits below.** Shape B (server-rendered
elements, client-virtualized mounting) keeps every heavy library server-side,
holds CLS at 0, and costs 19.7 KB gzip of client JS. At the route's real size
(40 reviews) virtualization is **not** a performance win: the DOM saving is
modest, the heap saving is nil, and scrolling — which the baselines do
entirely on the compositor — now runs JavaScript (~1s of long tasks under 4×
CPU throttle vs ~0.23s baseline). At `?count=500` the verdict inverts
decisively: −72%/−80% TBT, −80% DOM, −72% SSR hydration time, and INP drops
from 64–72 ms to 12–16 ms. The crossover for this content sits between those
two sizes — and the demo's capped lists are on the "don't" side of it, which
is itself the measured answer to why this repo never needed virtualization.

## What was built

Two new sibling routes virtualize the restaurant reviews list (40 markdown +
highlight.js review cards — the heaviest list in the demo) through one
repo-owned wrapper pair around `react-virtuoso`:

| Route | Shape (issue #184) | Where cards render | What crosses the RSC boundary |
| --- | --- | --- | --- |
| `/restaurant/:id/ssr-virtual` | **A** — client-rendered items | Browser (markdown in `ReviewCard`, as on `/ssr`) | n/a — whole page is `'use client'` |
| `/restaurant/:id/rsc-virtual` | **B** — server-rendered elements, client-virtualized mounting | Server (`ReviewCardForServer`, marked/hljs/sanitize-html stay server-side) | The pre-rendered element rows (serializable) — `itemContent` stays inside the client wrapper |

Both routes pass rows of **two** cards to the wrapper (`chunkPairs`): the list
is a 2-column `md:grid-cols-2` grid and a flat Virtuoso stacks one item per
row. `VirtuosoGrid` was rejected — it requires same-size items and review
heights vary ~5x.

Experiment knobs (defaults preserve the benchmark story; measurement-only —
they are honored only when the Rails server is started with
`ENABLE_BENCH_PARAMS=1`, as the flow below does, and are no-ops on the public
deployment):

- `?count=` — synthesized review count, default 40, clamped to 500. The
  generator consumes its seeded rng in build order, so the first 40 reviews of
  `?count=500` carry identical rng-derived content to the default page (only
  the request-relative `created_at` timestamps differ).
- `?initial=` — rows of two cards rendered into the server HTML
  (`initialItemCount`), default 3, `0` = no server-rendered rows. The reviews
  sit far below the fold (bio + 80 menu items first), so this knob is a
  no-JS/SEO-preview defense, not an LCP defense — without JavaScript, the `N`
  inlined rows are the entire list a no-JS user ever sees.

The wrapper (`app/javascript/components/shared/VirtualElementList.tsx` +
`VirtualElementListForServer.tsx`) is the only module allowed to import
`react-virtuoso` (the package ships **no** `'use client'` directive — F1). It
deliberately sets **no** `defaultItemHeight`: rows measure ≈406px on desktop
and ≈835px on mobile, no single estimate is right for both, a post-mount
switch is ignored (the estimate only seeds the size tree at init), and
matchMedia branching during render is a hydration mismatch. Omitting it lets
Virtuoso's probe measure the first real row after hydration —
breakpoint-correct by construction.

The review-card footer's static "Helpful" `<span>` became a real
`HelpfulButton` client component on **all** restaurant variants — the route
previously had no button at all, and INP cannot see scrolling (the Event
Timing API observes only clicks/taps/keys), so without a discrete interaction
the lanes could never record INP.

## Measurement method

- Webpack production build (`SHAKAPACKER_ASSETS_BUNDLER=webpack
  bin/build-production`) — the build BENCHMARKING.md documents and the closest
  to the deployed story. See "rspack finding" below for why this matters.
- Node renderer (port 3801) + Rails production (port 3001), local Postgres.
- `pnpm vitals` with the issue-184 harness extensions: restaurant lanes, a
  scripted wheel-scroll cycle to the bottom of the page and back (long tasks
  and long animation frames during the cycle are reported as scroll-phase
  metrics, **not** TBT), DOM-node counts (post-hydration / at bottom /
  post-scroll), GC'd JS heap (post-load / post-scroll), and a real Helpful
  click for INP after the cycle. TBT is frozen at the start of the scroll
  cycle — before the first forced GC — so it means exactly "load-phase
  blocking time" (the freeze boundary is `startTime`-exact; later non-scroll
  long tasks from harness activity land in a `postFreezeLongTaskTime`
  diagnostic instead). Instrumented replays across the matrix measured that
  harness contamination at 0.0 ms for every published TBT cell (evidence:
  `.dev-logs/qa-184/validation/`), so the published tables did not need
  re-measuring when the freeze landed. The cycle asserts completion: the
  step budget adapts to the measured document height, coverage is recorded per
  run (`scrollCycleComplete`/`scrollCoverage` in the JSON), and a traversal
  that cannot reach the bottom and return fails the lane instead of reporting
  partial numbers as "bottom-of-page". Every published lane completed
  (recorded steps: ≤224 of an adaptive budget; tallest measured page,
  mobile `?count=500`, is ~273k px ≈ 146 steps).
- Run matrix and iteration counts are stated with each table; medians shown,
  p75 in the JSON. Raw results: `.vitals-results/*-desktop-default.json`,
  `*-mobile-default.json`, `*-desktop-throttle.json`, `*-count500.json`,
  `*-initial0.json`.

## Results

All numbers are medians; p75/min/max and raw per-run values live in the JSON
files. Baseline lanes come from the full 5-lane runs; the virtual lanes from
the rerun after the CLS buffer fix (`m184v2-*`, same build, same servers,
baselines unaffected by the wrapper change). This machine shares load with
other services — TTFB/FCP/LCP vary run-to-run by up to ±30% (spreads in the
JSON), so treat load-phase deltas under ~200 ms as noise; DOM, heap, transfer,
CLS, and the scroll metrics are stable.

### Desktop, defaults (count=40, initial=3 rows) — 7 iterations, 2 warmup

| Median | ssr | client | rsc | ssr-virtual | rsc-virtual |
| --- | ---: | ---: | ---: | ---: | ---: |
| TTFB (ms) | 288 | 54 | 898 | 226 | 685 |
| FCP (ms) | 628 | 376 | 1284 | 692 | 1128 |
| LCP (ms) | 716 | 468 | 1384 | 756 | 1196 |
| CLS | 0 | 0.24 | 0 | 0 | 0 |
| TBT (ms) | 489 | 747 | 199 | 578 | 177 |
| INP (ms) | 32 | 32 | 48 | 32 | 24 |
| Hydration (ms) | 440 | 295 | 14 | 483 | 14 |
| Scroll long tasks (ms) | 0 | 0 | 0 | 7 | 4 |
| DOM nodes post-hydration | 5176 | 5179 | 5352 | 4217 | 4357 |
| DOM nodes at bottom | 5176 | 5179 | 5352 | 3867 | 4027 |
| JS heap post-load (MB) | 9.7 | 9.9 | 4.7 | 10.0 | 5.1 |
| JS heap post-scroll (MB) | 9.7 | 9.9 | 4.8 | 10.5 | 5.5 |
| JS transfer (KB) | 1642.3 | 1655.2 | 269.6 | 1705.3 | 329.3 |

At N=40 the honest read is a wash-to-slight-loss: ~1,100 of ~5,300 DOM nodes
removed (the unvirtualized 80-item menu dominates this page), heap flat or
slightly worse (Shape B still holds all 40 element rows; Shape A pre-creates
them), TBT within noise, and the client bundle 60 KB (19.7 KB gzip) heavier.
The client lane's CLS 0.24 is that baseline's pre-existing loading-swap
behavior, untouched here.

### Desktop, throttled (4× CPU, Slow 3G) — 5 iterations, 1 warmup

| Median | ssr | client | rsc | ssr-virtual | rsc-virtual |
| --- | ---: | ---: | ---: | ---: | ---: |
| FCP (ms) | 6048 | 5840 | 4120 | 6404 | 4258 |
| LCP (ms) | 6354 | 6068 | 4380 | 6780 | 4654 |
| CLS | 0 | 0.24 | 0 | 0 | 0 |
| TBT (ms) | 2955 | 3534 | 1048 | 2862 | 978 |
| INP (ms) | 96 | 108 | 88 | 52 | 64 |
| Hydration (ms) | 4597 | 4818 | 41 | 4715 | 31 |
| Scroll long tasks (ms) | 230 | 74 | 236 | 1002 | 1163 |
| Scroll long tasks (#) | 13 | 7 | 8 | 20 | 25 |

The throttled run exposes the core trade at N=40. **Scroll cost**: the
baselines scroll almost entirely on the compositor; the virtual lanes run
JavaScript on every scroll frame to shift the window — 4–5× more main-thread
blocking during the scripted fling cycle. **Interaction cost**: the discrete
Helpful click improves ~30–45% on the virtual lanes (a lighter tree to work
in). Windowing moves work from "once, up front" to "continuously, during
scroll" — measured, not just predicted.

### Desktop, `?count=500` — 5 iterations, 1 warmup

| Median | ssr | rsc | ssr-virtual | rsc-virtual |
| --- | ---: | ---: | ---: | ---: |
| TTFB (ms) | 1976 | 4702 | 404 | 2612 |
| FCP (ms) | 2430 | 5270 | 826 | 2944 |
| LCP (ms) | 2512 | 5332 | 920 | 3072 |
| CLS | 0 | 0 | 0 | 0 |
| TBT (ms) | 1752 | 804 | 503 | 159 |
| INP (ms) | 64 | 72 | 16 | 12 |
| Hydration (ms) | 1605 | 28 | 457 | 10 |
| Scroll long tasks (ms) | 6 | 2 | 294 | 78 |
| DOM nodes post-hydration | 20638 | 21274 | 4207 | 4592 |
| DOM nodes at bottom | 20638 | 21274 | 3867 | 4262 |
| JS heap post-load (MB) | 14.8 | 11.8 | 10.5 | 9.5 |
| JS heap post-scroll (MB) | 14.8 | 10.1 | 11.3 | 8.9 |

At N=500 everything flips. DOM stays ~flat for the virtual lanes (4.2–4.6k
nodes at any scroll position) while the baselines balloon to ~21k; TBT drops
72% (SSR) / 80% (RSC); SSR hydration drops 72%; INP lands at 12–16 ms vs
64–72 ms; the heap finally shows a real win. Note Shape B's structural cost:
`rsc-virtual` still renders and serializes all 500 cards server-side — TTFB
2.6 s and a 2.48 MB HTML document (vs 3.71 MB baseline; the flight payload
carries every row even though only ~10 are mounted). Shape A (`ssr-virtual`)
escapes the server render too (only the 3 preview rows are SSRed), which is
why its TTFB/LCP collapse to near the N=40 numbers — but it pays with all 500
bodies as JSON props plus client-side markdown work per mounted row.

### Mobile emulation (390×844, DPR 3, unthrottled) — 7 iterations, 2 warmup

| Median | ssr | client | rsc | ssr-virtual | rsc-virtual |
| --- | ---: | ---: | ---: | ---: | ---: |
| LCP (ms) | 724 | 312 | 1072 | 744 | 1144 |
| CLS | 0 | 0 | 0 | 0 | 0 |
| TBT (ms) | 517 | 810 | 230 | 763 | 150 |
| INP (ms) | 16 | 16 | 16 | 8 | 16 |
| Scroll long tasks (ms) | 0 | 0 | 0 | 56 | 44 |
| DOM nodes post-hydration | 5176 | 5179 | 5352 | 4085 | 4225 |

Same shape as desktop: modest DOM win, small scroll-JS cost, everything else
within noise. The single-column layout (~835 px rows) is why the CLS buffer is
sized in pixels, not rows — see the CLS section.

### `?initial=0` (no server-rendered rows) — 5 iterations, 1 warmup, desktop

| Median | ssr-virtual | rsc-virtual |
| --- | ---: | ---: |
| LCP (ms) | 714 | 1258 |
| CLS | 0 | 0 |
| TBT (ms) | 552 | 172 |
| DOM nodes post-hydration | 4217 | 4357 |

Indistinguishable from the default 3-row lanes on every load metric — direct
confirmation that `initialItemCount` is **not** an LCP/CLS lever on this route
(the list sits far below the fold). It is purely the no-JS/SEO preview knob:
with `initial=0` a no-JS user sees an empty reviews section; with the default
they see 6 reviews.

### CLS: held at 0, but it was earned

The scripted fling cycle initially recorded one deterministic shift on the
virtual lanes (0.03 desktop / 0.0997 mobile): when the scroll neared the end
of the list, the last rows' real heights corrected Virtuoso's estimated total
downward and pulled the sidebar up while visible. Under `useWindowScroll`
every estimate→real correction that lands in-viewport is a layout shift.
The fix is lead time: `increaseViewportBy.bottom = 2400` (~3 mobile rows / ~6
desktop rows) measures rows before they — and the section below the list —
become visible. With it, layout-shift traces record **zero** entries through
full fling cycles on desktop and mobile, at count=40 and count=500. The buffer
is the CLS-vs-mounted-DOM trade knob: it is also why the virtual lanes keep
~4.2k DOM nodes instead of ~3.9k.

### HTML document size (payload ledger)

| Route | count=40 | count=500 |
| --- | ---: | ---: |
| `/ssr` | 442 KB | 1,813 KB |
| `/ssr-virtual` | 364 KB | **636 KB** |
| `/rsc` | 976 KB | 3,625 KB |
| `/rsc-virtual` | 898 KB | **2,425 KB** |

Shape A's HTML scales with the preview (3 rows) plus the raw data props;
Shape B's still scales with N — the flight payload carries every
server-rendered row. That is the payload cost Shape C was designed to remove
(see below).

### The reconciliation question (issue #184's "single most valuable measurement")

Does Shape B's React work scale with the window or with N? Split answer,
measured at N=500: **commit-phase work scales with the window** — TBT 159 ms
(vs 804 baseline) and INP 12 ms don't move between N=40 and N=500 lanes —
but **decode/materialization scales with N**: the flight payload still
carries, and the client still parses and holds, all 500 element rows
(FCP 1128 ms → 2944 ms from N=40 to N=500; heap 5.1 → 9.5 MB). Virtualized
mounting caps what React commits, not what the payload ships.

## Bundle cost (F8)

Webpack production build, per-chunk:

| Chunk | Raw | Gzip | Loaded by |
| --- | ---: | ---: | --- |
| `react-virtuoso` library chunk | 60.2 KB | **19.2 KB** | `ssr-virtual`, `rsc-virtual` only |
| `VirtualElementListForServer` flight reference | 0.6 KB | 0.5 KB | `rsc-virtual` only |
| `HelpfulButtonForServer` flight reference | 2.1 KB | 1.3 KB | every restaurant variant (the new interaction target) |

The issue's reference figure was 24.4 KB gzip for the whole `dist/index.mjs`;
after bundling, minification and tree-shaking the real delta is **19.7 KB
gzip** on the RSC route. It does not appear on any other route.

## The verify:rsc red-team (F7)

The issue assumed `pnpm verify:rsc` "would catch" Shape A contamination. It
would not — confirmed by deliberately violating it:

1. A temporary `'use client'` component reachable from an RSC page rendered
   review markdown client-side through `utils/sanitizeAndRender` (the
   documented lint exemption).
2. `pnpm lint:rsc`: **green** (it only checks direct static imports of banned
   libs in `'use client'` files; `sanitizeAndRender` carries no directive).
3. The original `verify:rsc` entry-pack pass: **green** — client components
   inside an RSC tree load through `react-client-manifest.json` at hydration;
   their chunk ids arrive in the flight payload, never in the RSC entry pack's
   static chunk list.
4. The page really downloaded `markdown-libs` (975 KB raw) at hydration —
   runtime network trace, webpack build.

`scripts/check-rsc-chunks.mjs` now has a second pass that closes the hole: it
walks each RSC page's source tree to its `'use client'` boundaries and fails
if any boundary's flight-manifest chunk list contains a heavy-lib chunk
(fingerprinted by content, same as pass 1). The deliberate violation fails
with the exact boundary and chunk named; all 20 RSC pages (27 boundaries)
audit clean on both bundlers.

### Manifest chunk-group union pollution — why `*ForServer` re-exports are load-bearing

The new audit caught a second, subtler contamination path: a flight-referenced
module's manifest entry lists the chunks of **every chunk group that contains
the module**. The first version of the Virtuoso wrapper was a single
`'use client'` file imported by both the RSC tree and the (heavy) `ssr-virtual`
client entry — so its manifest entry listed that entry's whole chunk group,
markdown-libs included, and the `rsc-virtual` page would have downloaded it
at hydration. The `AddToCartSectionForServer` convention is the fix, now
enforced by the audit: the module that crosses the boundary must be a
dedicated `'use client'` re-export that no client entry bundles, so it gets
its own clean chunk group.

## Pre-existing rspack finding (upstream, documented not fixed)

On the CI-default **rspack** build (`bin/build-production`), the
`react-on-rails-rsc` client runtime chunk eagerly `import()`s **every**
client-reference module the moment `createFromReadableStream` is evaluated —
every RSC page downloads all ~68 client chunks, including `markdown-libs`
(975 KB) and `charting-libs`, regardless of what the page references. Verified
byte-identical behavior on `main` @ `5534e8d` (not introduced by this branch;
traces in the PR evidence). The webpack build does not do this — the same
restaurant RSC page loads 9 files and no markdown-libs.

`verify:rsc` cannot see this either (it is plugin runtime behavior, not chunk
wiring), and no static gate can. It is an upstream `RSCRspackPlugin` issue and
out of scope here; benchmarks in this document therefore use the webpack
build. Anyone benchmarking "how much JS does the RSC variant ship" on a local
rspack build is currently measuring this pathology, not the RSC story.

## Shape C — designed, not built

Shape C (virtualize + stream batches on `endReached`) needs a real request
boundary that this demo does not have:

- **Push-mode async props** (`stream_react_component_with_async_props`)
  transmit every batch inside the initial response whether or not the user
  scrolls — payload deferred, not saved.
- **Pull-mode** `propRequest` runs between server-side React and Rails during
  the initial render only — a client-side `endReached` cannot reopen a
  completed stream.
- Later batches therefore need their own endpoint returning a **Flight
  payload** decoded with the RSC client runtime (`createFromFetch`) — a plain
  fetch cannot append React elements — plus a single backing source for
  `totalCount` and the batches (today `restaurant.review_count` is a seeded
  stat while `reviews_payload` synthesizes exactly 40; passing either would
  make the endpoint truncate or invent a tail).
- It also reintroduces client-driven fetching — the pattern the `/client`
  variants exist to make look bad — so it needs honest labeling as its own
  lane, not a drop-in.

That is a meaningful slice of new surface (routes, Flight endpoint, decode
path, data plumbing) for a third point on a curve the A/B lanes already
bracket: B shows the payload cost of "ship all rows", A shows the bundle cost
of "ship data + code". Documented here as the designed-but-not-built option.

## Decision table (issue #184 "Decisions in scope")

| # | Decision | Outcome |
| --- | --- | --- |
| D1 | Route to virtualize | Restaurant reviews (40 markdown+hljs cards; heaviest per-item cost; the `ForServer` twin seam already existed) |
| D2 | Which shapes ship | A (`ssr-virtual`) + B (`rsc-virtual`) as routes; C designed-but-not-built (above). On the SSR variant Shape A adds no *new* contamination — the markdown libs are already that baseline's client bundle |
| D3 | Raise the list cap? | Default stays 40; `?count=` (≤500) parameterizes the synthesized generator for measurement. First 40 reviews keep identical rng-derived content (timestamps are request-relative) |
| D4 | SSR / `initialItemCount` | Default 3 rows (6 cards) as a no-JS/SEO preview; `?initial=0` measured as its own lane. No `defaultItemHeight` (responsive row heights; probe seeds per breakpoint) |
| D5 | Route naming | New sibling routes, matching `ssr-cached` / `rsc-pull` / `ppr` convention; header banners added for both variants |
| D6 | Harness | Extended `measure-vitals` (restaurant lanes, scroll cycle, DOM/heap sampling, scroll-phase long tasks + LoAF, `--mobile`, `--query`, fail-loud interaction selectors). Measured on the webpack build (see rspack finding) |
| D7 | Does it stay? | Keep the variants. They cost one wrapper pair + two sibling routes, the default-40 benchmark story is untouched, and the routes double as the demo's living answer to "when does virtualization pay?" — not at this page's real size (the capped lists are the right call), decisively at ?count=500. A negative-at-default, positive-at-scale result is exactly what the issue asked to have measured |

## Reproducing

```bash
SHAKAPACKER_ASSETS_BUNDLER=webpack SECRET_KEY_BASE=... bin/build-production
NODE_ENV=production node node-renderer.js &          # port 3800 (or RENDERER_PORT)
ENABLE_BENCH_PARAMS=1 RAILS_ENV=production RAILS_SERVE_STATIC_FILES=true SECRET_KEY_BASE=... \
  bundle exec rails server -p 3000 &   # ENABLE_BENCH_PARAMS=1 arms ?count/?initial
pnpm vitals -- --pages restaurant-ssr,restaurant-client,restaurant-rsc,restaurant-ssr-virtual,restaurant-rsc-virtual
pnpm vitals -- --pages restaurant-rsc,restaurant-rsc-virtual --throttle
pnpm vitals -- --pages restaurant-ssr,restaurant-rsc,restaurant-ssr-virtual,restaurant-rsc-virtual --query "count=500"
pnpm vitals -- --pages restaurant-ssr-virtual,restaurant-rsc-virtual --query "initial=0"
pnpm vitals -- --pages restaurant-ssr,restaurant-rsc,restaurant-ssr-virtual,restaurant-rsc-virtual --mobile
```

Restart **both** Rails and the node renderer (and clear
`.node-renderer-bundles`) after every rebuild: Rails caches the asset
manifest, and a stale webpack runtime hash 404s — which silently freezes
Virtuoso at its SSR-rendered rows while the rest of the page keeps working.

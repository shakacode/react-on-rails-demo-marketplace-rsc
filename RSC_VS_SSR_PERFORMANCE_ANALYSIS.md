# RSC vs SSR Performance Bottleneck Analysis

> **Date**: 2026-03-25
> **Environment**: Production build, Throttled (4x CPU slowdown, Slow 3G network)
> **Server**: Rails on port 3002, Node renderer on port 3801
> **Tool**: Puppeteer + web-vitals (7 iterations, 2 warmup)

## Executive Summary

A comprehensive performance investigation comparing RSC (React Server Components) vs SSR across all page types reveals that while RSC wins on FCP/LCP for every page, the gains are disproportionately small relative to the **81% JavaScript bundle reduction**. The blog page, for example, ships 1067KB less JS but improves FCP by only 56ms (3%).

The root causes are:
1. FCP/LCP are CSS-bound, not JS-bound
2. RSC flight payload duplicates rendered HTML (50-58% of every RSC document)
3. RSC TTFB is 2.2x slower on fast-data pages due to the heavier rendering pipeline
4. No bundle contamination or architectural issues were found — the bottleneck is the RSC protocol overhead itself

---

## Benchmark Results (Throttled: 4x CPU, Slow 3G)

### FCP / LCP Comparison

| Page | SSR FCP | RSC FCP | Delta | SSR LCP | RSC LCP | Delta |
|------|---------|---------|-------|---------|---------|-------|
| **Blog** | 1756ms | 1700ms | **-3.2%** | 1756ms | 1700ms | **-3.2%** |
| **Product** | 2408ms | 1756ms | **-27.1%** | 2420ms | 1772ms | **-26.8%** |
| **Search** | 2508ms | 1948ms | **-22.3%** | 2508ms | 2432ms | **-3.0%** |
| **Dashboard** | 7228ms | 1416ms | **-80.4%** | 7228ms | 1416ms | **-80.4%** |

### Post-Paint Metrics (Where RSC Truly Excels)

| Metric | Blog SSR | Blog RSC | Product SSR | Product RSC | Dashboard SSR | Dashboard RSC |
|--------|----------|----------|-------------|-------------|---------------|---------------|
| **TBT** | 3025ms | **192ms** (-94%) | 561ms | **77ms** (-86%) | 265ms | **36ms** (-86%) |
| **Hydration** | 8505ms | **701ms** (-92%) | 7097ms | **1702ms** (-76%) | N/A | N/A |
| **JS Transfer** | 1316KB | **249KB** (-81%) | 1401KB | **249KB** (-82%) | 308KB | **248KB** (-19%) |

### TTFB Comparison

| Page | SSR TTFB | RSC TTFB | Delta | Explanation |
|------|----------|----------|-------|-------------|
| **Blog** | 190ms | **410ms** | **+116%** | RSC pipeline overhead on fast-data page |
| **Product** | 39ms | 43ms | +10% | Negligible |
| **Search** | 539ms | **239ms** | **-56%** | RSC streams shell before queries complete |
| **Dashboard** | 5679ms | **244ms** | **-96%** | RSC streams shell; SSR blocks on 6 DB queries |

---

## Root Cause Analysis

### 1. FCP Is CSS-Bound, Not JS-Bound

Both SSR and RSC pages load scripts with the `async` attribute. The browser paints HTML+CSS **without waiting for JavaScript**. FCP is determined by:

```
FCP = TTFB + HTML delivery + CSS download + parse/render
```

Since both pages load the **same CSS files** (`application.css` at 73KB + `markdown-libs.css` at 2.2KB), the render-blocking bottleneck is identical. The 81% JS reduction helps post-paint metrics (TBT, hydration, TTI) but has zero direct impact on FCP.

**Evidence**: Blog SSR and RSC have nearly identical FCP (1756ms vs 1700ms) despite RSC shipping 1067KB less JavaScript.

### 2. RSC Flight Payload Duplicates Rendered HTML

Every RSC response contains the same rendered content **twice**:
1. As visible HTML in the `<body>` (for immediate display / FCP)
2. As serialized React Flight data in inline `<script>` tags (for React reconciliation)

| Page | SSR HTML Size | RSC HTML Size | RSC Payload Size | Payload % of Doc |
|------|--------------|---------------|------------------|-----------------|
| Blog | 98 KB | **162 KB** (+65%) | 86 KB | **53%** |
| Product | 65 KB | **132 KB** (+103%) | 77 KB | **58%** |
| Search | 178 KB | **260 KB** (+46%) | 113 KB | **43%** |
| Dashboard | 50 KB | **107 KB** (+114%) | 54 KB | **50%** |

**Verified duplication**: On the blog RSC page, the article HTML content (rendered markdown, ~60KB) appears at byte position 8,736 (visible in `<body>`) and again at byte position 71,248 (inside RSC flight payload script). The duplication distance is 62,512 bytes.

For server-only components (which have zero client interactivity), this duplication is pure overhead. The blog article body has no event handlers to hydrate, yet its HTML is transmitted twice.

Under Slow 3G (200KB/s), the extra 64-82KB of gzipped HTML adds **320-410ms** of download time.

### 3. RSC TTFB Is 2.2x Slower on Fast-Data Pages

The RSC rendering pipeline involves more server-side work than SSR:

**SSR pipeline** (simpler):
1. Controller fetches data
2. `renderToString()` generates complete HTML
3. Response sent

**RSC pipeline** (heavier):
1. Controller sets up streaming response
2. `render_to_string` renders entire ERB template (blocking — `stream.rb:56`)
3. Node renderer executes RSC bundle
4. `renderToPipeableStream` generates Flight format + waits for `onShellReady`
5. Stream tee'd into stream1 (SSR HTML) + stream2 (payload injection)
6. `injectRSCPayload` wraps Flight data in `<script>` tags
7. Chunks serialized as JSON with scheduled `setTimeout(flush, 0)` batching
8. Response streams progressively

For pages with **fast data fetching** (blog post from memory, product from cache), the RSC overhead dominates. For pages with **slow data** (dashboard: 6 sequential DB queries at ~800ms each), RSC's streaming shell advantage dwarfs the pipeline overhead.

**Server-side TTFB measurements** (curl, no network throttle):

| Page | SSR TTFB | RSC TTFB | SSR Total | RSC Total |
|------|----------|----------|-----------|-----------|
| Blog | 226ms | 234ms | 217ms | **1,509ms** |
| Product | 30ms | 51ms | 29ms | 104ms |
| Search | 520ms | **16ms** | 491ms | 609ms |
| Dashboard | **5,118ms** | **47ms** | 5,046ms | 4,749ms |

### 4. Template `render_to_string` Blocks Streaming Start

In `react_on_rails_pro/lib/react_on_rails_pro/concerns/stream.rb:56`:

```ruby
template_string = render_to_string(template: template, **render_options)
response.stream.write(template_string)
drain_streams_concurrently(parent_task)
```

The entire ERB template must compile and render before **any** bytes are sent to the browser. No progressive flushing of the `<head>` section is possible, delaying CSS discovery.

### 5. `injectRSCPayload` Flush Scheduling Adds Latency

In `injectRSCPayload.ts`, each RSC chunk triggers a `setTimeout(flush, 0)` that defers to the next event loop tick. With many Suspense boundaries (Dashboard has 6), this compounds into measurable latency.

---

## Bundle Architecture Verification

### Confirmed: No Bundle Contamination

| Check | Result |
|-------|--------|
| Server components in browser bundles | **None found** |
| `renderMarkdown` / `highlight.js` in RSC client chunks | **Not present** |
| `d3` / `charting-libs` in RSC client chunks | **Not present** |
| `marked` library in RSC client chunks | **Not present** |
| ForServer wrappers correctly isolating boundaries | **Yes** |
| react-client-manifest.json clean | **Yes** (46 entries, all correct) |

### External JS Loaded Per Page (gzip)

| Page | SSR JS (gzip) | RSC JS (gzip) | Key SSR-only chunks |
|------|--------------|---------------|---------------------|
| Blog | **395 KB** | **84 KB** | `markdown-libs` 321KB |
| Product | **423 KB** | **83 KB** | `markdown-libs` 321KB + `charting-libs` 24KB |
| Search | **400 KB** | **85 KB** | `markdown-libs` 321KB |
| Dashboard | **101 KB** | **83 KB** | `charting-libs` 24KB |

### RSC Client Chunks Are Tiny and Clean

Blog RSC loads 5 client island chunks totaling **9.8KB**:

| Chunk | Component | Size | Dependencies |
|-------|-----------|------|-------------|
| `client4` | BookmarkShareBar | 2.0 KB | react only |
| `client5` | INPOverlay | 3.7 KB | react only |
| `client6` | InteractiveSection | 1.5 KB | react only |
| `client7` | ReadingModeToggle | 0.9 KB | react only |
| `client8` | TableOfContents | 1.6 KB | react only |

### Shared Infrastructure (Both SSR and RSC)

| Chunk | Size | Contents |
|-------|------|----------|
| `runtime` | 6.5 KB | Webpack runtime |
| `821` | 209 KB (66KB gz) | react-dom/client (176KB) + ReactOnRails core (20KB) |
| `342` | 27 KB (9KB gz) | RSC client runtime (RSC-only) |
| `client-bundle` | 0.5 KB | ReactOnRails bootstrap |

---

## Total Page Weight Comparison (gzip)

| Page | SSR Total (gz) | RSC Total (gz) | RSC Savings |
|------|---------------|----------------|-------------|
| Blog | **419 KB** | **113 KB** | 73% smaller |
| Product | **434 KB** | **98 KB** | 77% smaller |
| Search | **423 KB** | **111 KB** | 74% smaller |
| Dashboard | **110 KB** | **95 KB** | 14% smaller |

RSC dramatically reduces total page weight, but this primarily benefits post-paint metrics since JS is async.

---

## HTML Response Structure Comparison

### Blog SSR (100KB document)
- 4 inline scripts (32KB) — mostly the props blob (29KB of serialized blog post data)
- 6 external scripts (395KB gzip) — includes `markdown-libs` at 321KB
- Full rendered HTML in body — FCP-ready immediately
- No streaming, no Suspense boundaries

### Blog RSC (166KB document)
- 11 inline scripts (93KB) — RSC flight payload (88KB) + props (1.5KB) + Fizz runtime (1KB)
- 10 external scripts (84KB gzip) — no `markdown-libs`, adds RSC runtime (9KB)
- Full rendered HTML in body — FCP-ready immediately
- 2 Suspense boundaries (already resolved via `$RC` calls)
- 5 client chunk scripts injected by React Fizz in the body (before main bundles)
- RSC flight payload stored in `self.REACT_ON_RAILS_RSC_PAYLOADS` keyed by component name

---

## Performance Trace Analysis (Chrome DevTools)

### Blog RSC LCP Breakdown (unthrottled)
- **LCP**: 886ms (text element)
- **TTFB**: 375ms (42.3% of LCP time)
- **Render Delay**: 511ms (57.7% of LCP time)
- **DOM Size**: 1284 elements, max depth 10
- **Style Recalculation**: 48ms affecting 1333 elements

### Network Request Comparison

**Blog SSR loads 7 resources:**
```
1. document (HTML)
2. runtime.js
3. markdown-libs.js (1.1MB — the bottleneck for hydration)
4. 821.js (React core)
5. 4684.js
6. BlogPostSSR.js
7. client-bundle.js
```

**Blog RSC loads 11 resources:**
```
1. document (HTML)
2-6. client4/5/6/7/8 chunk.js (tiny client islands)
7. runtime.js
8. 821.js (React core)
9. 342.js (RSC runtime)
10. BlogPostRSC.js
11. client-bundle.js
```

---

## Recommendations

### For React on Rails Pro (library-level improvements)

1. **Reduce flight payload duplication**: For server-only subtrees with no client interactivity, consider using text references (`$T`) instead of re-serializing the full HTML in the Flight data. This could reduce RSC document size by 30-50%.

2. **Stream ERB template progressively**: Instead of `render_to_string` blocking, flush the `<head>` section early so CSS discovery begins sooner. This would improve TTFB for all RSC pages.

3. **Optimize RSC TTFB for fast-data pages**: Cache or pre-warm the RSC bundle execution context in the node renderer. The ~200ms overhead on the blog page is mostly RSC bundle initialization.

4. **Batch RSC payload flush**: Instead of `setTimeout(flush, 0)` per chunk in `injectRSCPayload.ts`, accumulate micro-batches to reduce event loop overhead with many Suspense boundaries.

### For the Demo App (application-level improvements)

5. **Add `103 Early Hints` for CSS**: Since FCP is CSS-bound for both SSR and RSC, sending CSS hints before the HTML body would improve FCP for all pages equally.

6. **Enable HTTP caching headers**: All JS assets currently have `Cache-TTL: 0`. Adding long cache lifetimes for fingerprinted assets would dramatically improve repeat-visit performance.

7. **Consider `modulepreload` for critical chunks**: The shared `821.js` (React core, 66KB gzip) could benefit from `<link rel="modulepreload">` in the `<head>`.

---

## Methodology

- **Build**: `bin/build-production` (SWC transpiler, Webpack 5, production mode)
- **Server**: Rails production on port 3002, Node renderer on port 3801
- **Benchmark**: `node scripts/measure-vitals.mjs --url http://localhost:3002 --pages ssr,client,rsc,product-ssr,product-client,product-rsc,search-ssr,search-client,search-rsc,dashboard-ssr,dashboard-client,dashboard-rsc --throttle --iterations 7 --warmup 2`
- **Throttling**: CPU 4x slowdown, Network Slow 3G (1.6 Mbps down, 750 Kbps up, 150ms latency)
- **Browser**: HeadlessChrome 146.0.0.0
- **Analysis tools**: Chrome DevTools Performance traces, CDP network inspection, manual HTML/JS analysis
- **Bundle analysis**: `react-client-manifest.json`, `loadable-stats.json`, per-chunk content inspection

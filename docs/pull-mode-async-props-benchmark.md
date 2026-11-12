# Pull-Mode Async Props + `unstable_cache` Benchmark

Issue: [#165 — Use bidirectional (pull-mode) async props in the demo and verify they work with unstable_cache](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/165)

Branch: `165-use-bidirectional-pull-mode-async-props` | Stack: React on Rails 17.0.0 | Date: 2026-08-03

## What pull-mode async props do

In **push mode** (existing `/product/rsc`), Rails eagerly pushes all async props to the Node renderer regardless of whether the JS-side `unstable_cache` would use them. Every request runs all 4 DB queries even when the cached component would replay Flight bytes without touching the data.

In **pull mode** (`/product/rsc-pull`), React requests each prop on demand via `propRequest`. Rails only queries the DB when it receives a request. Combined with `unstable_cache`, cached components never call `getAsyncProp()` → no `propRequest` → no DB query.

### Architecture: React.cache()-based async prop store

Instead of threading `getReactOnRailsAsyncProp` through every component as a prop, we use `React.cache()` to create a **per-RSC-request singleton** (`asyncPropStore.ts`):

- Root component calls `initAsyncPropStore(getReactOnRailsAsyncProp)` once
- Child components import `getAsyncProp(propName)` directly — no prop drilling
- `React.cache()` is request-scoped via React's internal `AsyncLocalStorage` — fully concurrency-safe

### Pull-mode cached components

| Component | Cache ID | Prop name | What it caches |
|-----------|----------|-----------|----------------|
| `AsyncProductDetailsPullRSC` | `pull-product-details` | `product_details` | description + features + specs (marked + highlight.js) |
| `AsyncReviewStatsPullRSC` | `pull-product-review-stats` | `review_stats` | rating distribution SVG bar chart |
| `AsyncReviewsPullRSC` | `pull-product-reviews` | `reviews` | 5 customer reviews (date-fns formatting) |
| `AsyncRelatedProductsPullRSC` | `pull-product-related` | `related_products` | 4 related product cards |

All entries use `revalidate: 60` (60-second TTL). Cache key includes `productId` to prevent cross-product cache collisions.

## DB query reduction

Methodology: Rails `development.log` `Completed` line showing query count and ActiveRecord time. Server warmed with 3+ requests before measurement to ensure both node-renderer workers have warm caches.

### Results

| Mode | Cache state | DB queries | ActiveRecord time | Total response time |
|------|-------------|------------|-------------------|---------------------|
| Push (`/product/rsc`) | Every request | **4 queries** | ~30–90 ms | ~500–865 ms |
| Pull (`/product/rsc-pull`) | MISS (cold) | **4 queries** | ~42–1202 ms | ~1000–5500 ms |
| Pull (`/product/rsc-pull`) | **HIT (warm)** | **1 query** | **~4–19 ms** | **~775–800 ms** |

The single remaining query on cache HIT is the controller's `find_product` for sync props (hero section). The 3 async prop queries (`review_stats`, `reviews`, `related_products`) are completely eliminated.

### Raw query log (representative samples)

**Push mode — always 4 queries:**
```
Completed 200 OK in 497ms (ActiveRecord: 28.0ms (4 queries, 0 cached))
Completed 200 OK in 572ms (ActiveRecord: 89.9ms (4 queries, 0 cached))
Completed 200 OK in 806ms (ActiveRecord: 54.4ms (4 queries, 0 cached))
```

**Pull mode — cache MISS (cold):**
```
Completed 200 OK in 3780ms (ActiveRecord: 91.1ms (4 queries, 0 cached))
```

**Pull mode — cache HIT (warm):**
```
Completed 200 OK in 775ms (ActiveRecord: 3.6ms (1 query, 0 cached))
Completed 200 OK in 800ms (ActiveRecord: 18.8ms (1 query, 0 cached))
Completed 200 OK in 800ms (ActiveRecord: 4.3ms (1 query, 0 cached))
```

## Web Vitals comparison

Methodology: `pnpm vitals:quick` — Puppeteer headless Chrome, 3 iterations (1 warmup, 2 measured), no throttle, local dev server (`localhost:3100`), `RSC_CACHE_ENABLED=true`. Both pages measured with warm `unstable_cache` (pull-mode has been loaded enough times for both node-renderer workers to have warm caches).

### Results (median of 2 measured runs)

| Metric | Push (`/product/rsc`) | Pull (`/product/rsc-pull`) | Delta | Improvement |
|--------|----------------------|---------------------------|-------|-------------|
| **TTFB** | 298.6 ms | 200.3 ms | −98.3 ms | **−33%** |
| **FCP** | 638.0 ms | 352.0 ms | −286.0 ms | **−45%** |
| **LCP** | 654.0 ms | 368.0 ms | −286.0 ms | **−44%** |
| **TBT** | 185.0 ms | 13.0 ms | −172.0 ms | **−93%** |
| **INP** | 144.0 ms | 120.0 ms | −24.0 ms | **−17%** |
| **Streaming** | 174.7 ms | 68.7 ms | −106.0 ms | **−61%** |
| **CLS** | 0.0000 | 0.0000 | 0 | Same |
| **JS Transfer** | 1640.1 KB | 1640.1 KB | 0 | Same |
| **JS Decoded** | 1638.9 KB | 1639.0 KB | +0.1 KB | Same |

### Raw data

| Page | Run | TTFB | FCP | LCP | TBT | INP | CLS | Streaming |
|------|-----|------|-----|-----|-----|-----|-----|-----------|
| Push | warmup | 260.8 | 564.0 | 564.0 | 146.0 | 128.0 | 0 | 120.3 |
| Push | 1 | 357.7 | 636.0 | 652.0 | 185.0 | 152.0 | 0 | 229.2 |
| Push | 2 | 239.5 | 640.0 | 656.0 | 185.0 | 136.0 | 0 | 120.2 |
| Pull | warmup | 199.0 | 440.0 | 472.0 | 8.0 | 104.0 | 0 | 35.0 |
| Pull | 1 | 201.7 | 352.0 | 368.0 | 18.0 | 136.0 | 0 | 102.5 |
| Pull | 2 | 198.9 | 352.0 | 368.0 | 8.0 | 104.0 | 0 | 34.9 |

### Analysis

1. **Pull-mode with warm cache is dramatically faster across every timing metric.** The TTFB improvement (−33%) comes from Rails responding faster when it skips 3 DB queries. FCP and LCP improve by the same −286ms because the first paint is not blocked on async prop resolution.

2. **TBT drops 93% (185ms → 13ms)** — the main thread is almost never blocked. In push mode, the browser processes all 4 async prop streams even though their rendered output is the same. In pull mode with warm cache, the cached Flight bytes are replayed instantly with minimal JS execution.

3. **Streaming duration drops 61%** — from 174.7ms to 68.7ms. On a cache HIT, the response stream completes faster because cached components emit pre-rendered bytes without waiting for the render pipeline.

4. **JS bundle size is identical** — pull-mode uses the same client components (ProductImageGallery, AddToCartSection) as push-mode. The only difference is the server-side rendering path.

5. **CLS is 0 across both modes** — pull-mode introduces no layout shift regressions. The Suspense fallback skeletons match the rendered content dimensions.

## Comparison with `unstable_cache` alone (issue #83)

The earlier `unstable_cache` benchmark ([docs/unstable-cache-benchmark.md](./unstable-cache-benchmark.md)) showed that `unstable_cache` **alone** saves server-side render time (31% for product page) but has **no measurable effect on Web Vitals** because the DB queries still run on every request in push mode.

Pull-mode changes this: by combining `unstable_cache` with bidirectional async props, cached components skip both the render **and** the DB query. This produces the Web Vitals improvements that `unstable_cache` alone couldn't deliver.

| Approach | Server render savings | DB query savings | Web Vitals impact |
|----------|----------------------|------------------|-------------------|
| `unstable_cache` alone (push) | 31% (product) | None — queries always run | **None** |
| `unstable_cache` + pull-mode | 31% (product) | **75% fewer queries on HIT** (4→1) | **FCP −45%, LCP −44%, TBT −93%** |

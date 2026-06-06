# `unstable_cache` Performance Benchmark

Issue: [#83 — Use `unstable_cache` function at the demo and check its affect on performance](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/83)

Branch: `83-unstable-cache` | Stack: React on Rails 17.0.0-rc.1 | Date: 2026-06-05

## What `unstable_cache` does

`unstable_cache` (from `react-on-rails-pro/cache`) wraps an async server component and memoizes its serialized RSC payload. On a cache hit the wrapped function is never called — the stored Flight bytes are replayed directly into the response stream. Default backend is an in-memory LRU (1000 entries, per-worker). Cache key = `SHA-256(buildId + id + JSON.stringify(args))`.

## Cached fragments per page

| Page | Fragment | What it renders | Render cost |
|------|----------|----------------|-------------|
| **Product** | `CachedProductDetails` | description + features + specs | marked + highlight.js |
| | `CachedProductSpecSheet` | long-form spec markdown + price ladder | marked + hljs + sanitize-html + intl-messageformat |
| | `CachedReviewsList` | 5 customer reviews | date-fns (formatDistanceToNow, format) |
| | `CachedReviewStats` | rating distribution chart | SVG bar chart |
| | `CachedRelatedProducts` | 4 related product cards | light JSX |
| **Search** | `CachedResultsGrid` | 24 product cards (each w/ markdown description) | 24× marked + highlight.js |
| **Blog** | `CachedArticleBody` | full blog post (~25KB markdown) | marked + highlight.js |
| **Restaurant** | `CachedBioSection` | chef bio + origin story | 2× marked + hljs + sanitize-html |
| | `CachedMenuSection` | 80 dishes w/ markdown descriptions + multi-currency prices | 80× marked + hljs + sanitize-html + intl-messageformat |
| | `CachedReviewsSection` | 40 guest reviews w/ markdown bodies | 40× marked + hljs + sanitize-html |
| | `CachedSidebarSection` | neighborhood guide + FAQ | 2× marked + hljs + sanitize-html |

All entries use `revalidate: 60` (60-second TTL).

## Server-side render time (Rails Duration log)

Methodology: JIT-warm renderer (3 full warmup rounds, all pages), then cache TTL expiry → cold measurement → warm measurements. Two independent cycles, averaged. Single-worker renderer (`workersCount: 2`, sequential requests). Metric is Rails' `Rendered show_rsc.html.erb … Duration` — the full server-side round-trip (Rails emit blocks + renderer RSC render), excluding client download.

### Results

| Page | COLD (cache miss) | WARM (cache hit) | Absolute savings | Relative savings |
|------|-------------------|------------------|-----------------|-----------------|
| **Product** | 86.7 ms | 59.5 ms | **27.2 ms** | **31%** |
| **Search** | 59.0 ms | 47.8 ms | **11.2 ms** | **19%** |
| **Blog** | 48.3 ms | 44.8 ms | **3.5 ms** | **7%** |
| **Restaurant** | 1013 ms | 844 ms | **169 ms** | **17%** |

### Raw data

**Cycle 1** (cold → 5 warm samples):

| Page | COLD | WARM samples |
|------|------|-------------|
| Product | 91.2 | 63.0, 70.3, 57.6, 51.8, 53.2 |
| Search | 57.7 | 46.3, 51.5, 47.9, 49.4, 45.5 |
| Blog | 51.1 | 44.7, 45.3, 44.1, 44.4, 45.2 |
| Restaurant | 1027.1 | 800.9, 1052.8, 800.4, 820.3, 753.8 |

**Cycle 2** (cold → 3 warm samples):

| Page | COLD | WARM samples |
|------|------|-------------|
| Product | 82.1 | 57.3, 69.5, 54.1 |
| Search | 60.3 | 45.3, 47.8, 48.0 |
| Blog | 45.4 | 43.6, 46.8, 44.7 |
| Restaurant | 999.5 | 798.4, 981.3, 741.0 |

### Analysis

1. **Savings scale with cached render cost.** The restaurant page has 124 markdown renders + 80 intl-messageformat price ladders — the most expensive cached work — and saves the most absolute time (~170ms). The blog page caches a single `renderMarkdown()` call and saves only ~3.5ms.

2. **Product benefits most proportionally (31%).** Five cached fragments cover the entire below-the-fold render: markdown description, spec sheet with price ladder, review list with date-fns formatting, SVG rating chart, and related products grid.

3. **Search saves 19%** by caching the 24-card results grid. Each `SearchResultCard` calls `renderMarkdown(description.slice(0, 300))` — 24 marked + highlight.js invocations per page load. Cache hit rate depends on query repetition; the default LRU (1000 entries) holds ~40 distinct search result pages.

4. **Restaurant has high variance** (~100ms between samples) because the Duration includes the pre-existing O(n²) cumulative RSC payload embedding (28MB response for 65KB of source data). This payload generation cost is independent of `unstable_cache` and dominates the timing. Excluding the single outlier per cycle, warm renders average ~787ms — a **22% savings** from the 1013ms cold baseline.

## Web Vitals impact (Lighthouse)

Methodology: Lighthouse 12.8.2, headless Chrome, `--only-categories=performance`, 3 runs per page per cache state. Warm = cache primed before each run. Cold = renderer restarted, JIT warmed, then 65s TTL expiry between runs. Medians reported (averages are skewed by Lighthouse's own FCP variance of up to 6s between identical runs).

### Results (median of 3 runs)

| Page | Metric | COLD | WARM | Delta |
|------|--------|------|------|-------|
| **Product** | Score | 68 | 68 | 0 |
| | FCP | 4413 ms | 4426 ms | +13 ms |
| | LCP | 5442 ms | 5513 ms | +71 ms |
| | TBT | 96 ms | 95 ms | -1 ms |
| | TTFB | 97 ms | 100 ms | +3 ms |
| | CLS | 0 | 0 | 0 |
| **Search** | Score | 62 | 60 | -2 |
| | FCP | 4860 ms | 5168 ms | +308 ms |
| | LCP | 12653 ms | 12701 ms | +48 ms |
| | TBT | 85 ms | 105 ms | +20 ms |
| | TTFB | 77 ms | 76 ms | -1 ms |
| | CLS | 0 | 0 | 0 |
| **Blog** | Score | 52 | 59 | +7 |
| | FCP | 10495 ms | 4262 ms | -6233 ms |
| | LCP | 10877 ms | 10864 ms | -13 ms |
| | TBT | 236 ms | 230 ms | -6 ms |
| | TTFB | 77 ms | 75 ms | -2 ms |
| | CLS | 0 | 0 | 0 |
| **Restaurant** | Score | 27 | 27 | 0 |
| | FCP | 155778 ms | 155893 ms | +115 ms |
| | LCP | 156078 ms | 155893 ms | -185 ms |
| | TBT | 2156 ms | 2116 ms | -40 ms |
| | TTFB | 1055 ms | 1014 ms | -41 ms |
| | CLS | 0 | 0 | 0 |

### Raw data

**WARM cache (3 runs):**

| Page | Run | Score | FCP | LCP | TBT | CLS | SI | TTFB |
|------|-----|-------|-----|-----|-----|-----|-----|------|
| Product | 1 | 68 | 4426 | 5443 | 99 | 0 | 4426 | 100 |
| Product | 2 | 56 | 10445 | 11540 | 78 | 0 | 10445 | 101 |
| Product | 3 | 69 | 4115 | 5513 | 95 | 0 | 4115 | 88 |
| Search | 1 | 55 | 11390 | 12665 | 105 | 0 | 11390 | 76 |
| Search | 2 | 60 | 5168 | 12745 | 138 | 0 | 5168 | 76 |
| Search | 3 | 62 | 4859 | 12701 | 84 | 0 | 4859 | 73 |
| Blog | 1 | 59 | 4262 | 10887 | 261 | 0 | 4262 | 85 |
| Blog | 2 | 62 | 3964 | 10843 | 223 | 0 | 3964 | 75 |
| Blog | 3 | 52 | 10491 | 10864 | 230 | 0 | 10491 | 73 |
| Restaurant | 1 | 27 | 155933 | 156083 | 2227 | 0 | 155933 | 1014 |
| Restaurant | 2 | 27 | 155893 | 155893 | 2030 | 0 | 155893 | 932 |
| Restaurant | 3 | 27 | 155790 | 155790 | 2116 | 0 | 155790 | 1033 |

**COLD cache (3 runs):**

| Page | Run | Score | FCP | LCP | TBT | CLS | SI | TTFB |
|------|-----|-------|-----|-----|-----|-----|-----|------|
| Product | 1 | 68 | 4423 | 5442 | 96 | 0 | 4423 | 97 |
| Product | 2 | 68 | 4413 | 5437 | 96 | 0 | 4413 | 129 |
| Product | 3 | 69 | 4121 | 5516 | 86 | 0 | 4121 | 97 |
| Search | 1 | 61 | 4860 | 12761 | 141 | 0 | 4860 | 84 |
| Search | 2 | 62 | 4860 | 12653 | 85 | 0 | 4860 | 77 |
| Search | 3 | 62 | 4858 | 12652 | 85 | 0 | 4858 | 72 |
| Blog | 1 | 52 | 10495 | 10867 | 226 | 0 | 10495 | 83 |
| Blog | 2 | 52 | 10504 | 10877 | 236 | 0 | 10504 | 75 |
| Blog | 3 | 59 | 4264 | 10881 | 268 | 0 | 4264 | 77 |
| Restaurant | 1 | 27 | 155777 | 155777 | 2153 | 0 | 155777 | 1055 |
| Restaurant | 2 | 27 | 155887 | 156187 | 2218 | 0 | 155887 | 1119 |
| Restaurant | 3 | 27 | 155778 | 156078 | 2156 | 0 | 155778 | 1025 |

### Analysis

1. **`unstable_cache` has no measurable effect on Web Vitals for these pages.** The server-side savings (27-170ms) are swamped by multi-second client-side render costs. The per-run variance in FCP alone (up to 6000ms between identical runs) exceeds the entire cache effect by 35-170x.

2. **TTFB is the only metric where the server-side savings could theoretically surface**, but the 27-170ms savings are within Lighthouse's measurement noise at these timescales. Restaurant shows the largest median TTFB improvement (-41ms), consistent with its 170ms server-side savings, but this doesn't propagate to FCP/LCP because client-side work dominates.

3. **The bottleneck is client-side, not server-side.** Product and search have FCP ~4.5s and LCP ~5-12s despite TTFB under 100ms. The gap between TTFB and FCP is client-side JS parsing, hydration, and rendering — work that `unstable_cache` cannot help with.

4. **Restaurant is bottlenecked by payload size.** The 28MB response (due to pre-existing O(n^2) cumulative RSC payload embedding) produces FCP/LCP of ~156s regardless of cache state. The 170ms server-side savings is invisible at this scale.

5. **CLS is 0 across all pages in both states**, confirming that `unstable_cache` introduces no layout shift regressions.

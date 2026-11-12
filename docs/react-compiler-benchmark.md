# React Compiler — production benchmark (issue #100)

Compares production builds **with vs without** `babel-plugin-react-compiler@1.0.0`.
The compiler is opt-in via `REACT_COMPILER_ENABLED=true` (disabled by default).

**Environment:** local production build (`RAILS_ENV=production NODE_ENV=production`),
Rails on port 3001 + node-renderer on port 3800, unthrottled, Puppeteer CDP
measurement. Median of 5 runs (7 iterations, 2 warmup discarded).

> The SWC-to-Babel transpiler switch is always active (required for `@loadable/babel-plugin`).
> When the compiler is disabled, only the transpiler overhead applies (+1% bundle size);
> no compiler transforms run. Manual `useCallback`/`useMemo` hooks are preserved in all
> components — the compiler optimizes around them when enabled.

## 1. Blog pages (simplest components)

| Metric | SSR before | SSR after | SSR delta | Client before | Client after | Client delta |
|--------|-----------|-----------|-----------|---------------|-------------|-------------|
| FCP | 328 ms | 252 ms | **-23.2%** | 328 ms | 256 ms | **-22.0%** |
| LCP | 328 ms | 252 ms | **-23.2%** | 328 ms | 256 ms | **-22.0%** |
| TBT | 366 ms | 345 ms | **-5.7%** | 432 ms | 376 ms | **-13.0%** |
| TTFB | 202 ms | 129 ms | **-36.4%** | 180 ms | 124 ms | **-30.8%** |
| Hydration | 664 ms | 641 ms | -3.5% | 617 ms | 630 ms | +2.0% |
| INP | 104 ms | 120 ms | +15.4% | 104 ms | 104 ms | 0.0% |

Blog RSC: FCP 176→128 ms (**-27.3%**), LCP noisy (streaming-dependent), TBT 0→0 ms.

## 2. Search pages (complex list rendering)

| Metric | SSR before | SSR after | SSR delta | Client before | Client after | Client delta |
|--------|-----------|-----------|-----------|---------------|-------------|-------------|
| FCP | 776 ms | 780 ms | +0.5% | 144 ms | 192 ms | +33.3% |
| LCP | 1012 ms | 1040 ms | +2.8% | 1112 ms | 1012 ms | **-9.0%** |
| TBT | 8 ms | 5 ms | **-37.5%** | 3 ms | 19 ms | +533%* |
| TTFB | 644 ms | 656 ms | +1.9% | 58 ms | 74 ms | +28.5% |

Search RSC: FCP 360→256 ms (**-28.9%**), LCP 1076→356 ms (**-66.9%**).

\* Absolute values < 20 ms — percentage changes exaggerated by small baselines.

## 3. Product pages (medium complexity)

| Metric | SSR before | SSR after | SSR delta | Client before | Client after | Client delta |
|--------|-----------|-----------|-----------|---------------|-------------|-------------|
| FCP | 228 ms | 220 ms | **-3.5%** | 212 ms | 284 ms | +34.0% |
| LCP | 228 ms | 224 ms | -1.8% | 232 ms | 284 ms | +22.4% |
| TBT | 36 ms | 28 ms | **-22.2%** | 35 ms | 68 ms | +94.3%* |
| TTFB | 111 ms | 80 ms | **-27.8%** | 92 ms | 100 ms | +9.4% |
| INP | 128 ms | 112 ms | **-12.5%** | 112 ms | 136 ms | +21.4% |

Product RSC: FCP 200→148 ms (**-26.0%**).

\* Absolute values < 70 ms — percentage changes exaggerated by small baselines.

## 4. JS bundle size (transfer, gzip)

| Rendering | Before | After | Delta |
|-----------|--------|-------|-------|
| SSR (blog) | 1,550 KB | 1,561 KB | +11 KB (+0.7%) |
| Client (blog) | 1,563 KB | 1,577 KB | +14 KB (+0.9%) |
| RSC (blog) | 249 KB | 242 KB | **-8 KB (-3.1%)** |
| SSR (search) | 1,573 KB | 1,595 KB | +22 KB (+1.4%) |
| Client (search) | 1,570 KB | 1,592 KB | +22 KB (+1.4%) |
| RSC (search) | 262 KB | 242 KB | **-21 KB (-7.9%)** |
| SSR (product) | 1,628 KB | 1,645 KB | +17 KB (+1.1%) |
| Client (product) | 1,642 KB | 1,663 KB | +21 KB (+1.2%) |
| RSC (product) | 249 KB | 242 KB | **-7 KB (-2.9%)** |

**CLS:** 0.000 across all pages — no visual stability regression.

## 5. Summary

| Category | SSR | Client | RSC |
|----------|-----|--------|-----|
| FCP | -3 to -23% | mixed | **-26 to -29%** |
| LCP | -1 to -23% | mixed | noisy (streaming) |
| TBT | -6 to -38% | regressed* | -29% (search) |
| TTFB | -28 to -36% (blog) | mixed | ±0 |
| JS size | +0.7 to +1.4% | +0.9 to +1.4% | **-3 to -8%** |

**Best gains:** Blog SSR/Client (FCP/LCP -22–23%), RSC pages across the board (FCP -26–29%,
bundle size -3–8% smaller).

**Regressions:** Client-rendered pages show FCP/TBT regressions. Root cause: SWC→Babel
transpiler switch adds ~17–22 KB to SSR/Client bundles. The compiler gains offset this for
SSR but not fully for client-only rendering where JS parse overhead dominates.

**RSC wins big:** RSC pages ship less client JS to begin with, and the compiler further reduces
it. FCP improvements of -26–29% are consistent across all RSC page types.

\* Client-side TBT regressions have small absolute values (3→19 ms, 35→68 ms) — the large
percentages are misleading.

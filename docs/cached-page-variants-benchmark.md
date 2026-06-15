# Cached page variants — benchmark & investigation (issue #97)

Compares each demo page **uncached vs cached**, **SSR vs RSC**. Cached SSR uses
`cached_react_component`; cached RSC uses `cached_stream_react_component` (plain stream) or the new
`cached_stream_react_component_with_async_props` (async-props pages).

**Environment:** local `bin/dev` (development mode), unthrottled, `:memory_store` cache, single Puma
process + 2 node-renderer workers. Absolute numbers are dev-mode (unminified JS, per-request code
checks); the **deltas** between uncached and cached are the result. Server timing = median of 7 runs;
web vitals = median of 5 runs (puppeteer).

> Cold miss ≈ the uncached number: a miss does the full render plus a small cache write. Verified
> directly — the first request to `/blog/rsc-cached` after a fresh boot took ~2.4 s and logged
> `MISS → WROTE`, matching the uncached RSC render cost; subsequent requests hit at ~29 ms.

## 1. Server render time (total, median ms)

| Page family | SSR uncached | SSR cached (hit) | SSR gain | RSC uncached | RSC cached (hit) | RSC gain |
|---|---|---|---|---|---|---|
| restaurant | 200 | 30 | 6.7× | 414 | 34 | 12.2× |
| product | 92 | 27 | 3.4× | 94 | 27 | 3.5× |
| product-search | 653 | 29 | 22.5× | 609 | 27 | 22.6× |
| blog | 281 | 33 | 8.5× | 1558 | 29 | **53.7×** |

**A cache hit collapses every page — SSR and RSC alike — to a ~27–34 ms floor** (read the cached
bytes + HTTP; no render work). The speedup factor is just `uncached / 30 ms`, so the heavier the
uncached render, the bigger the gain. At the raw server-render level, **cached RSC gain ≥ cached SSR
gain** (RSC uncached is usually the slower baseline — e.g. blog RSC carries a 1.5 s async-section
delay — so it gains *more*). The issue's hypothesis ("cached RSC gain < cached SSR gain") does **not**
hold for server render time.

## 2. Web vitals (median ms, unthrottled)

| Metric | SSR | SSR cached | RSC | RSC cached | Search SSR | Search SSR cached | Search RSC | Search RSC cached |
|---|---|---|---|---|---|---|---|---|
| TTFB | 288 | **27** | 74 | **32** | 671 | **27** | 79 | **28** |
| FCP | 532 | 170 | 162 | 240 | 928 | 154 | 154 | 246 |
| LCP | 532 | **170** | 162 | **240** | 928 | **172** | 778 | **338** |
| TBT | 855 | 859 | 15 | 8 | 159 | 193 | 7.5 | 0.5 |
| CLS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| JS shipped | 3386 KB | 3386 KB | 1403 KB | 1403 KB | 3525 KB | 3525 KB | 1482 KB | 1482 KB |

## 3. Investigation — why cached RSC's *LCP* gain is smaller than cached SSR's (acceptance-critical)

Two different "gains" must be separated:

- **Server render time / TTFB — equal.** Caching slashes TTFB for both strategies to ~27–32 ms.
  Caching the streamed RSC chunks is exactly as effective as caching the SSR HTML string.
- **User-perceived LCP — smaller for RSC.** SSR LCP: 532 → 170 (blog), 928 → 172 (search) — caching
  saves 360–760 ms. RSC LCP: 162 → 240 (blog, no gain / noise), 778 → 338 (search). RSC's *LCP*
  improves much less (or not at all) from caching.

**Root cause:** RSC **streaming already decouples LCP from total render time.** The uncached RSC page
sends its shell + above-the-fold (LCP) content in the *first* chunk almost immediately (blog RSC TTFB
74 ms, LCP 162 ms), while the slow work — async section emits, node round-trips, the 1.5 s
recommendation delay — streams in *after* the LCP element and never gates it. So the uncached RSC LCP
is **already near-optimal**, leaving little for caching to recover. SSR, by contrast, blocks the
*entire* response (including the LCP element) on the full server render, so caching that render
directly collapses SSR's LCP.

In other words: RSC spends its performance budget making the **uncached** experience fast (early LCP
via streaming); SSR has no such mechanism, so caching is where SSR claws back that gap. Caching makes
SSR's LCP competitive with RSC's — it does **not** mean RSC caching is broken.

Two corollaries from the data:
- **TBT is unchanged by caching** (SSR 855 → 859; RSC 15 → 8 within noise). TBT is client-side JS
  execution (hydration), and caching is purely server-side — the shipped JS bytes are byte-identical
  cached vs uncached. RSC's low TBT (8–15 ms vs SSR's 855 ms) comes from shipping ~1.4 MB vs ~3.4 MB
  of JS, an RSC property independent of caching.
- **Cache hits are genuinely exercised** (not the "hit never happens" hypothesis): the async-props
  pages log `MISS → WROTE → HIT`; warm TTFB ~27 ms confirms replay. Note `RORP_CACHE_HIT` is **not**
  set on this view-level *stream* cache (only on the Hash-returning `react_component` path), so hits
  are verified via the helper's log markers / timing, not that flag.

## 3b. Cached SSR vs cached RSC — head to head (web vitals)

Comparing the two *cached* variants directly (both warm hits), so server-render latency is removed
from both and only the inherent SSR-vs-RSC differences remain:

| Metric | blog SSR cached | blog RSC cached | search SSR cached | search RSC cached |
|---|---|---|---|---|
| TTFB | 27 ms | 32 ms | 27 ms | 28 ms |
| FCP | 170 ms | 240 ms | 154 ms | 246 ms |
| **LCP** | **170 ms** | 240 ms | **172 ms** | 338 ms |
| **TBT** | 859 ms | **8 ms** | 193 ms | **0.5 ms** |
| CLS | 0 | 0 | 0 | 0 |
| JS shipped | 3386 KB | **1403 KB** | 3525 KB | **1482 KB** |

- **TTFB — a tie** (~27–32 ms). Both are cache hits replaying bytes; neither renders.
- **LCP / FCP — cached SSR wins** (blog 170 vs 240, search 172 vs 338). With render latency cached
  away, SSR delivers the LCP element in one synchronous HTML payload, whereas cached RSC still
  *progressively* streams + client-reconciles its chunks, so the LCP element paints slightly later
  (most visible on search, where the results — the LCP content — arrive as a streamed section).
- **TBT — cached RSC wins by ~100×** (blog 8 vs 859 ms, search 0.5 vs 193 ms). RSC ships ~half the
  JavaScript (1.4 MB vs 3.4 MB), so far less main-thread blocking during hydration. This gap is an
  RSC property, untouched by caching.
- **CLS — tie at 0** for both (Suspense fallbacks preserve real heights).

**Bottom line:** caching does not change *which* strategy wins each metric — it only erases the
server-render-time gap that previously made uncached SSR look slow. Once both are cached, the choice
is the usual SSR-vs-RSC trade-off, now both served at cache-hit speed: **cached SSR for the lowest
LCP, cached RSC for far lower TBT and ~half the JS.**

## 4. Takeaways

- Fragment caching is a large win for **server render time / TTFB** on every page, SSR and RSC alike
  (3–54×), and is most dramatic on expensive pages (product-search SSR 653 → 29 ms; blog RSC
  1558 → 29 ms).
- For **LCP**, caching most helps **SSR** (which had no streaming to hide its render latency). RSC's
  LCP is already fast uncached, so caching mainly improves its *total* completion time and TTFB, not
  its LCP.
- Caching does nothing for **TBT / JS size** — those are client-side and identical cached vs uncached;
  reducing them is RSC's job (less JS), not the cache's.

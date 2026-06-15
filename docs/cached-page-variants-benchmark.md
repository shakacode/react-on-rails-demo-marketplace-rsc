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
| FCP | 532 | 170 | 162 | 132 | 928 | 154 | 154 | 116 |
| LCP | 532 | **170** | 162 | **132** | 928 | **172** | 778 | **200** |
| TBT | 855 | 859 | 15 | 8 | 159 | 193 | 7.5 | 0.5 |

> Cached LCP/FCP are subject to high dev-mode run-to-run variance; the cached values shown here are
> the controlled medians from §3c (an initial N=5 pass reported a spurious cached-RSC LCP of 240/338
> that did not reproduce).
| CLS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| JS shipped | 3386 KB | 3386 KB | 1403 KB | 1403 KB | 3525 KB | 3525 KB | 1482 KB | 1482 KB |

## 3. Investigation — where the caching gain shows up (acceptance-critical)

The issue asks: does cached RSC gain *less* than cached SSR, and if so why? Separate two "gains":

- **Server render time / TTFB — equal.** Caching slashes TTFB for both strategies to ~27–32 ms.
  Caching the streamed RSC chunks is exactly as effective as caching the SSR HTML string. None of the
  issue's hypotheses (RSC "not caching the same units of work", hit-never-exercised) hold — hits are
  confirmed (`MISS → WROTE → HIT`) and the cached document replays in ~1 chunk by ~35 ms.
- **User-perceived LCP — caching helps SSR more, but cached RSC does NOT end up slower.** Caching
  *gains* more for SSR (blog 532 → 168, search 928 → 208 — saves ~360–720 ms) than for RSC (blog
  162 → 132, search 778 → 200). But the *absolute* cached LCP is a tie/RSC-ahead (blog RSC 132 vs SSR
  168; search RSC 200 vs SSR 208). **The "cached RSC LCP regression" from the first quick pass was
  measurement noise and does not reproduce — see §3c.**

**Why SSR's LCP gains more from caching:** RSC streaming already decouples LCP from total render
time. The uncached RSC page sends its shell + above-the-fold (LCP) content in the *first* chunk
almost immediately (blog RSC TTFB 74 ms, LCP 162 ms), while the slow work — async section emits, node
round-trips, the 1.5 s recommendation delay — streams in *after* the LCP element and never gates it.
So the uncached RSC LCP is already near-optimal, leaving little for caching to recover. SSR blocks the
*entire* response (including the LCP element) on the full server render, so caching that render
collapses SSR's LCP. RSC spends its budget making the **uncached** experience fast; caching is where
SSR claws back that gap — ending in a tie, not an RSC regression.

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
from both and only the inherent SSR-vs-RSC differences remain. **LCP/FCP below are corrected medians
from a controlled interleaved A/B (N=15) — see §3c; the first quick N=5 harness pass reported a
spurious RSC LCP of 240/338 ms that did not reproduce.**

| Metric | blog SSR cached | blog RSC cached | search SSR cached | search RSC cached |
|---|---|---|---|---|
| TTFB | 27 ms | 32 ms | 27 ms | 28 ms |
| FCP | 168 ms | 132 ms | 192 ms | 116 ms |
| **LCP** | 168 ms | **132 ms** | 208 ms | **200 ms** |
| **TBT** | 859 ms | **8 ms** | 193 ms | **0.5 ms** |
| CLS | 0 | 0 | 0 | 0 |
| JS shipped | 3386 KB | **1403 KB** | 3525 KB | **1482 KB** |

- **TTFB — a tie** (~27–32 ms). Both are cache hits replaying bytes; neither renders.
- **LCP / FCP — a tie, RSC slightly ahead** (blog RSC 132 vs SSR 168; search RSC 200 vs SSR 208).
  There is **no LCP regression** for cached RSC (see §3c for the controlled re-measurement that
  overturned the initial spurious figure). RSC's FCP is consistently a touch earlier because its
  streamed shell paints sooner.
- **TBT — cached RSC wins by ~100×** (blog 8 vs 859 ms, search 0.5 vs 193 ms). RSC ships ~half the
  JavaScript (1.4 MB vs 3.4 MB), so far less main-thread blocking during hydration. This gap is an
  RSC property, untouched by caching.
- **CLS — tie at 0** for both (Suspense fallbacks preserve real heights).

**Bottom line:** once both are cached they are effectively tied on TTFB/FCP/LCP/CLS, and cached RSC
wins decisively on TBT and JS size. There is **no metric on which cached RSC loses** to cached SSR in
the controlled data.

## 3c. "RSC LCP regression" — investigated and refuted

A first quick web-vitals pass (`scripts/measure-vitals.mjs`, **N=5, warmup=1**) reported cached RSC
LCP of **240 ms (blog)** and **338 ms (search)** vs cached SSR 170/172 ms — an apparent regression.
It does **not reproduce**. Investigation (all warm hits — cache markers showed 36 HIT / 1 MISS /
1 WROTE per component):

| Measurement | blog SSR LCP | blog RSC LCP | search SSR LCP | search RSC LCP |
|---|---|---|---|---|
| Quick harness, N=5 (original) | 170 | **240** (p75 356) | 172 | **338** (p75 480) |
| Interleaved A/B, N=15 | 168 (sd 7) | **132** (sd 22) | 208 (sd 20) | **200** (sd 18) |
| Factorial cache-ON, N=10 | 224 | 196 | — | — |
| Factorial cache-OFF, N=10 | 216 | 204 | — | — |
| Factorial cache-OFF + click (harness-like), N=10 | 228 | 200 | — | — |
| Same harness re-run, N=12 | 258 (p75 488) | **120** (p75 124) | 172 | 198 |

**Root cause: it was small-sample measurement noise, not a property of cached RSC.** In unthrottled
local dev, LCP has high run-to-run variance (GC, node-renderer worker scheduling, CPU contention).
With N=5 the median is easily dragged into the tail by 1–2 outliers — the original RSC p75 of 356/480
is the tell. Re-running the *same* tool with N=12 flipped blog strongly in RSC's favour (120 vs 258)
and SSR itself swung to 258 (p75 488), confirming the instability is in the measurement, not the page.
Across a controlled interleaved A/B and a 3-condition factorial, **cached RSC LCP is equal-or-better
than cached SSR in every condition.**

Contributing factors (verified, none a real regression):
- **The cached document arrives in ~1 chunk by ~35 ms for both** strategies (CDP byte timeline) — a
  hit replays chunks fast (`react_on_rails_pro_cache_helper.rb` hit path), so there is no progressive-
  streaming penalty on a warm RSC hit. The LCP element is identical for SSR/RSC (blog = the content
  `<p>`; search = the first product `<img>`, which is eager / `fetchpriority`-high).
- **The harness amplifies RSC variance**: it disables the browser HTTP cache (`runner.mjs` — re-fetches
  the LCP image every run → variable image decode in LCP) and, for `hasStreaming` (RSC) pages only,
  waits for streaming to resolve before clicking to finalize LCP — a longer, more variable LCP
  observation window for RSC than SSR. This widens RSC's spread without reflecting real UX.
- **RSC does have a slightly heavier LCP upper-tail** (extra client steps: Flight-payload decode +
  Suspense reconciliation on top of HTML paint), which is why a tiny sample can misreport it. The
  *median* is unaffected.

Caveat: this is unthrottled local dev. A throttled / production profile (slow CPU + network) is the
right next step to confirm mobile behaviour; proving a *real* RSC LCP mechanism would require a
main-thread trace showing Flight decode / Suspense reveal delaying the actual LCP candidate — which
the current data does not show. (This investigation was cross-reviewed with Codex gpt-5.5 @ xhigh.)

## 4. Takeaways

- Fragment caching is a large win for **server render time / TTFB** on every page, SSR and RSC alike
  (3–54×), and is most dramatic on expensive pages (product-search SSR 653 → 29 ms; blog RSC
  1558 → 29 ms).
- For **LCP**, caching most helps **SSR** (which had no streaming to hide its render latency). RSC's
  LCP is already fast uncached, so caching mainly improves its *total* completion time and TTFB, not
  its LCP.
- Caching does nothing for **TBT / JS size** — those are client-side and identical cached vs uncached;
  reducing them is RSC's job (less JS), not the cache's.

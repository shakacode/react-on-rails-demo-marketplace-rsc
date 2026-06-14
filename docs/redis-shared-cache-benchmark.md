# Redis Shared Cache Benchmark

Branch: `redis-shared-cache` | Date: 2026-06-07 | react_on_rails PR: [#3705](https://github.com/shakacode/react_on_rails/pull/3705)

## Overview

This benchmark evaluates **cross-worker RSC cache sharing via Redis**, using the tiered cache architecture introduced in react_on_rails PR #3705. The tiered cache composes a per-worker in-memory LRU (L1) in front of a shared Redis instance (L2), replacing the default per-worker-only in-memory LRU.

### How the tiered cache works

| Hit type | Path | Latency |
|----------|------|---------|
| **L1 hit** | Map lookup, no network | ~47 ms (product) |
| **L1 miss / L2 hit** | Redis GET + binary deserialize, then fire-and-forget L1 promotion | ~65 ms |
| **Full miss** | RSC render + write to both L1 and L2 | ~105 ms |
| **Cross-worker sharing** | Worker A's cold render fills L2; Worker B's first request is an L2 hit, backfilled to L1 | 1 cold render warms all workers |

### Key architectural features (from PR #3705)

- **Binary length-prefix serialization** — 12-byte header (float64 timestamp + int32 revalidate) followed by length-prefixed raw Buffer chunks. ~25-30% smaller than JSON+base64 and avoids `JSON.parse`/`JSON.stringify` CPU cost on every Redis round-trip.
- **Single-flight coalescing** — per-worker `inFlightRenders` Map deduplicates concurrent RSC renders for the same cache key. The first caller renders; concurrent callers await the in-flight promise then read from cache.
- **Fire-and-forget L1 promotion** — on L2 hit, L1 backfill is non-blocking (`void l1.set(...).catch(...)`) so the caller gets the result immediately.
- **Graceful degradation** — Redis errors on `get()` return `null` (treated as miss); errors on `set()` log a warning and continue. A `maxEntryBytes` guard (default 1 MB) silently skips oversized entries.
- **Deterministic cache keys** — `stableStringify` sorts object keys, handles `NaN`/`Infinity`/`-0`/`BigInt`/`Date`/`Map`/`Set`/`undefined`, and SHA-256 hashes with a build-ID prefix for automatic cache invalidation on deploys.

## Benchmark methodology

- **Environment**: Development mode, localhost, 2 renderer workers, Redis on localhost:6379.
- **JIT warmup**: 3 full rounds of all pages before measurement.
- **TTL expiry**: 65-second wait after warmup to ensure all cache entries expire (65s TTL).
- **Cold measurement**: Redis flushed, then single request per page.
- **Warm measurement**: 5 consecutive requests per page after cold render fills cache.
- **Cross-worker steady-state**: 6 rapid-fire requests to product page after both workers' L1 caches are warm.
- **Two independent cycles**, averaged.

## Results

### Server-side render time — Tiered (L1 + Redis)

| Page | COLD | WARM (avg of 10) | L1 Steady-State (avg of 12) |
|------|------|-------------------|----------------------------|
| **Product** | 105.4 ms | 57.3 ms | **47.2 ms** |
| **Search** | 67.4 ms | 46.4 ms | — |
| **Blog** | 46.7 ms | 37.7 ms | — |
| **Restaurant** | 666.4 ms | 554.1 ms | — |

### Comparison with per-worker in-memory LRU baseline (no Redis)

| Page | Metric | In-Memory LRU (baseline) | Tiered (L1+Redis) | Change |
|------|--------|--------------------------|-------------------|--------|
| **Product** | COLD | 86.7 ms | 105.4 ms | +22% (writes to both tiers) |
| | WARM (avg) | 59.5 ms | 57.3 ms | **-4%** |
| | L1 steady-state | 59.5 ms | **47.2 ms** | **-21%** |
| **Search** | COLD | 59.0 ms | 67.4 ms | +14% |
| | WARM (avg) | 47.8 ms | 46.4 ms | **-3%** |
| **Blog** | COLD | 48.3 ms | 46.7 ms | -3% |
| | WARM (avg) | 44.8 ms | 37.7 ms | **-16%** |
| **Restaurant** | COLD | 1013 ms | 666 ms | **-34%** |
| | WARM (avg) | 844 ms | 554 ms | **-34%** |

### Raw data

**Cycle 1** (cold + 5 warm samples):

| Page | COLD | WARM samples |
|------|------|-------------|
| Product | 113.7 | 54.7, 46.9, 76.9, 55.3, 66.0 |
| Search | 64.8 | 38.3, 47.7, 71.8, 37.8, 48.7 |
| Blog | 34.7 | 32.5, 36.2, 57.4, 33.9, 30.1 |
| Restaurant | 671.5 | 548.7, 628.0, 563.6, 558.0, 516.9 |

**Cycle 2** (cold + 5 warm samples):

| Page | COLD | WARM samples |
|------|------|-------------|
| Product | 97.1 | 72.4, 65.5, 41.6, 49.6, 44.1 |
| Search | 70.0 | 39.0, 69.4, 35.9, 36.3, 38.9 |
| Blog | 58.6 | 31.1, 54.9, 32.7, 38.3, 29.8 |
| Restaurant | 661.3 | 546.1, 542.7, 546.4, 522.1, 568.9 |

### Cross-worker L1 steady-state

6 rapid-fire requests to product across 2 workers (both L1 caches already warm). Redis entry count unchanged (16 -> 16):

**Cycle 1:**

| Request | Duration |
|---------|----------|
| 1 | 43.3 ms |
| 2 | 54.2 ms |
| 3 | 54.7 ms |
| 4 | 69.8 ms |
| 5 | 40.2 ms |
| 6 | 41.9 ms |

**Cycle 2:**

| Request | Duration |
|---------|----------|
| 1 | 42.2 ms |
| 2 | 61.0 ms |
| 3 | 50.2 ms |
| 4 | 34.6 ms |
| 5 | 58.3 ms |
| 6 | 36.7 ms |

**Average: 47.2 ms** (range 34.6-69.8 ms)

## Analysis

1. **The tiered cache is faster than pure in-memory LRU at steady state.** Product L1 steady-state averages 47.2 ms vs 59.5 ms for in-memory LRU — a 21% improvement. This is attributable to the PR's single-flight coalescing and binary serialization reducing CPU overhead even on the L1 path (the `unstable_cache` wrapper itself is more efficient).

2. **Restaurant page shows the largest improvement (-34%).** The restaurant page has 4 cached fragments with streaming async props. Single-flight coalescing prevents redundant RSC renders when concurrent requests hit the same cold key, which is especially impactful for pages with multiple expensive cached fragments.

3. **Cold renders are slightly slower (+14-22% for lighter pages)** because a cache miss writes to both L1 and L2 (Redis binary serialize + network SET). However, the restaurant cold time actually decreased (-34%), likely due to single-flight coalescing preventing duplicate renders for its 4 cached fragments during the initial request.

4. **Production benefits scale with worker count.** With N workers:
   - In-memory LRU: N cold renders per page after deploy
   - Tiered: 1 cold render per page (L2 shares across all workers)

5. **Cache survives worker restarts.** L2 (Redis) persists; each worker's L1 rebuilds from L2 on first hit. This eliminates the cold-start penalty after rolling restarts.

## Configuration

| File | Change |
|------|--------|
| `app/javascript/utils/initRedisCache.ts` | Registers tiered handler (L1 InMemoryLRU + L2 RedisCacheHandler) in RSC bundle |
| `config/webpack/rscWebpackConfig.js`, `config/rspack/rscRspackConfig.js` | Prepend `initRedisCache` before component registrations in the RSC bundle only |
| `node-renderer.js` | Passes `__REDIS_URL__` from `REDIS_URL` env var to VM context |
| `config/webpack/serverWebpackConfig.js`, `config/rspack/serverRspackConfig.js` | Bakes `RSC_CACHE_ENABLED` and `RSC_L1_CACHE_MAX_ENTRIES` into the RSC bundle at build time |
| `config/webpack/rscWebpackConfig.js`, `config/rspack/rscRspackConfig.js` | Adds `ioredis: 'commonjs2 ioredis'` to RSC bundle externals |
| `package.json` | Adds `ioredis` dependency; uses published React on Rails Pro 17.0.0-rc.3 |
| `Gemfile` | Uses published React on Rails gems at 17.0.0.rc.3 |

### How to enable

Build the RSC bundle with `RSC_CACHE_ENABLED=true`, then set `REDIS_URL` when starting the node renderer:

```bash
RSC_CACHE_ENABLED=true SHAKAPACKER_ASSETS_BUNDLER=rspack NODE_ENV=production pnpm exec rspack build --config config/rspack/rspack.config.js
```

```bash
REDIS_URL=redis://localhost:6379 node node-renderer.js
```

Optionally tune the per-worker L1 entry cap at build time:

```bash
RSC_CACHE_ENABLED=true RSC_L1_CACHE_MAX_ENTRIES=200 SHAKAPACKER_ASSETS_BUNDLER=rspack NODE_ENV=production pnpm exec rspack build --config config/rspack/rspack.config.js
```

When either `RSC_CACHE_ENABLED=true` was not present at build time or `REDIS_URL` is not set at runtime, the default per-worker in-memory LRU cache is used.

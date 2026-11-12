# Shared Redis cache for RSC fragments

The demo can share `unstable_cache` fragments across renderer workers through a
shared Redis L2 cache. Each RSC bundle also keeps an in-memory L1 cache, so a warm
local hit avoids a Redis request. Redis shares completed entries across workers
and preserves them through worker restarts. Concurrent cold requests in different
workers can still render the same fragment: single-flight coalescing is per worker.

Cache only server-only fragments with public data. The current cache decoder cannot
replay client component references inside the RSC bundle. Search results and
restaurant reviews contain interactive client islands, so those sections render
normally while eligible product, blog and restaurant sections remain cached. Never
share personalized data without including its identity and permissions in the key.

## Configuration

`RSC_CACHE_ENABLED` and `RSC_L1_CACHE_MAX_ENTRIES` are **build-time** settings for
both webpack and rspack. `REDIS_URL` is a **runtime** setting on the Node renderer.
Changing a build-time setting requires rebuilding the bundles.

| Build flag | Runtime Redis URL | Behavior |
| --- | --- | --- |
| Unset or anything other than `true` | Any value | Fragment caching is disabled; components render normally. |
| `true` | Unset | The existing per-worker in-memory fragment cache is used. |
| `true` | Set | Per-worker L1 plus shared Redis L2 is registered before RSC components. |

Build all production bundles with caching enabled:

```bash
RSC_CACHE_ENABLED=true bin/build-production
```

Start a local Redis server, then start the renderer:

```bash
REDIS_URL=redis://127.0.0.1:6379 node node-renderer.js
```

To change the L1 capacity from its default of 50 entries:

```bash
RSC_CACHE_ENABLED=true RSC_L1_CACHE_MAX_ENTRIES=200 bin/build-production
```

The L1 capacity must be a positive integer; invalid values use 50. Redis is an
optional deployment dependency. Unavailable Redis reads become cache misses;
local hits and writes remain usable. Redis entries larger than the upstream
handler's size limit are skipped. Workers may therefore render a fragment more
than once, even when sharing is enabled.

The Redis URL stays out of browser bundles and is passed only to trusted renderer
VMs. Use a disposable Redis database for experiments and keep credentials out of
logs and checked-in configuration. The renderer exposes a callback instead of
serializing the URL in its startup configuration; the cache startup message does
not print the URL.

## Repeatable checks

With `redis-server` available on `PATH`:

```bash
pnpm test:rsc-cache
```

This builds the real initializer with the installed React on Rails cache package
and exercises its `CacheHandler` contract in separate VM contexts against isolated
Redis servers on temporary ports. It checks sharing, local-only fallback, disabled
configuration, LRU eviction, TTL preservation on promotion, and Redis loss. It does
not substitute for verifying a running Rails app with renderer worker processes.

For a running app, build with caching enabled and request the same RSC page on
multiple workers. Inspect the dedicated Redis instance with `SCAN MATCH rorp:*`,
then restart a renderer worker and verify that its first request reads the shared
entry. Also check startup without `REDIS_URL` and expiry after revalidation.

## Performance evidence

Compare production builds on the same dependency versions and data. Keep the
cache flag enabled on both sides; leave `REDIS_URL` unset for the local-cache
control and set it for the shared-cache experiment. Measure cold requests,
requests handled by a fresh worker, and steady-state local hits separately.
Redis adds network work on misses; it does not promise faster warm L1 hits.

The renderer owns one Redis connection per worker, shared by its bundle VM
generations. Worker termination releases that connection through the renderer's
normal process lifecycle; no per-VM signal handlers or private shutdown API are used.
The RSC E2E gate builds with caching enabled. `test:renderer-context` also runs
the Redis contract tests; hosts without `redis-server` report those cases as
explicit skips. The running-app Redis and scheduled-restart checks remain manual.

The [June 7 measurements](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/blob/53c10b37c92b6b5fb247b9ed5940ca4eab2797aa/docs/redis-shared-cache-benchmark.md)
used development builds and earlier React on Rails packages. They are historical
observations, not evidence of a speedup on the current dependency stack. In
particular, those measurements cannot isolate the effect of Redis from upstream
cache implementation changes.

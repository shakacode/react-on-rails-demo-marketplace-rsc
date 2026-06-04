# Rspack Migration Findings

## Overview

This document tracks the migration of the LocalHub demo from Webpack 5 to Rspack 2, using `react-on-rails-rsc`'s `RspackPlugin` (not Rspack's native `experiments.rsc`).

**Date:** 2026-05-17
**Issue:** https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/64

## How to switch bundlers

Shakapacker 10.1 supports env-variable switching:

```bash
# Build with Rspack (all 3 bundles)
SHAKAPACKER_ASSETS_BUNDLER=rspack npx @rspack/cli build --config config/rspack/rspack.config.js

# Build with Webpack (default)
npx webpack --config config/webpack/webpack.config.js

# Build individual bundles
RSC_BUNDLE_ONLY=yes SHAKAPACKER_ASSETS_BUNDLER=rspack npx @rspack/cli build --config config/rspack/rspack.config.js
SERVER_BUNDLE_ONLY=yes SHAKAPACKER_ASSETS_BUNDLER=rspack npx @rspack/cli build --config config/rspack/rspack.config.js
CLIENT_BUNDLE_ONLY=yes SHAKAPACKER_ASSETS_BUNDLER=rspack npx @rspack/cli build --config config/rspack/rspack.config.js
```

## Prerequisites

- **Node.js 20.19.0+ or 22.12.0+** (required by Shakapacker 10.1 and `@rspack/core` v2)
- Packages: `@rspack/core @rspack/cli @rspack/plugin-react-refresh rspack-manifest-plugin`

## Build performance

| Build | Rspack | Webpack | Speedup |
|-------|--------|---------|---------|
| All 3 bundles (dev) | **4.7s** | 36.2s | **7.6x** |
| Client only | 3.7s | ~33s | ~9x |
| Server only | 1.3s | ~34s | ~26x |
| RSC only | 1.3s | ~34s | ~26x |

## Config files created

All in `config/rspack/`, mirroring `config/webpack/`:

| File | Purpose |
|------|---------|
| `rspack.config.js` | Entry point — loads env-specific config |
| `commonRspackConfig.js` | Base config via `generateRspackConfig()` from `shakapacker/rspack` |
| `clientRspackConfig.js` | Client bundle — `RSCRspackPlugin({ isServer: false })` |
| `serverRspackConfig.js` | Server bundle — `RSCRspackPlugin({ isServer: true })` |
| `rscRspackConfig.js` | RSC bundle — `react-on-rails-rsc/WebpackLoader` with `enforce: 'post'` |
| `ServerClientOrBoth.js` | Multi-compiler orchestration |
| `development.js` | Dev config with `@rspack/plugin-react-refresh` |
| `production.js` | Production config |
| `test.js` | Test config |

## react-on-rails-rsc RSCRspackPlugin fixes

Three bugs were found and fixed in `react-on-rails-rsc/src/react-server-dom-rspack/plugin.ts`:

### Bug 1: Server plugin skipped FS walk

The `beforeCompile` hook only ran the FS walk for `isServer: false`. The webpack plugin runs it for BOTH modes — server needs it to discover client-only entry files that aren't in the server bundle's dependency graph.

**Fix:** Always run `resolveAllClientFiles()`.

### Bug 2: Missing server manifest entries for client-only files

Four `.client.tsx` startup files (e.g., `ProductPageClient.client.tsx`) were in the client manifest but missing from the server manifest. The `createSSRManifest()` function in `client.node.ts` throws when any client manifest entry is missing from the server manifest.

**Fix (initial):** Fallback manifest entries for discovered client files not in the module graph. These point to the server-bundle chunk.

### Bug 3: Server plugin skipped async import injection (production-only SSR error)

The Phase 2 injection (prepending `import()` statements to the Flight client runtime module) only ran for client bundles (`!isServer`). Without this, client-only `.client.tsx` files weren't in the server bundle's module graph. The fallback entries from Bug 2 used string path IDs that couldn't be resolved at runtime, causing "Element type is invalid: expected a string... but got: undefined" errors during SSR of RSC pages in production.

Additionally, without injection, rspack's production module concatenation merged 31 modules into a single `ConcatenatedModule` (all sharing `id=7541`), losing per-module identity.

**Symptoms:** Production-only — `react-dom-server.node.production.js` threw "Element type is invalid" errors caught by Suspense boundaries. Pages appeared to work but had ~60% less initial SSR HTML content compared to webpack (content filled in during client hydration). Dev mode was unaffected because React's dev build handles the resolution differently.

**Fix:** Call `setInjectionState()` and add the injection-loader rule for BOTH client and server bundles. With injection, all 40 manifest entries get proper numeric module IDs (39 unique IDs vs. the previous 6 with 31 sharing one). Server bundle's `LimitChunkCountPlugin({ maxChunks: 1 })` merges the async chunks into the single server chunk.

**Result:** Zero renderer errors in both dev and prod. SSR HTML output matches webpack within 0.03%.

**Upstream:** The Rspack plugin fixes are available in `react-on-rails-rsc@19.0.5-rc.2`.

## Page status

### RSC pages — fully working

| Page | Status | SSR | Hydration | Errors |
|------|--------|-----|-----------|--------|
| `/product/rsc` | 200 | Yes | Clean | 0 |
| `/product-search/rsc` | 200 | Yes | Clean | 0 |
| `/blog/rsc` | 200 | Yes | Clean | 0 |
| `/blog/rsc-simple` | 200 | Yes | Clean | 0 |
| `/restaurant/1/rsc` | 200 | Yes | Clean | 0 |

### SSR pages — fully working

| Page | Status | SSR | Hydration | Errors |
|------|--------|-----|-----------|--------|
| `/product/ssr` | 200 | Yes | Clean | 0 |
| `/product-search/ssr` | 200 | Yes | Clean | 0 |
| `/blog/ssr` | 200 | Yes | Clean | 0 |
| `/restaurant/1/ssr` | 200 | Yes | Clean | 0 |

### Client pages — all fail (production rspack build)

| Page | Status | Notes |
|------|--------|-------|
| `/product/client` | 500 | Needs `loadable-stats.json` |
| `/product-search/client` | 500 | Needs `loadable-stats.json` |
| `/blog/client` | 500 | Needs `loadable-stats.json` |
| `/restaurant/1/client` | 500 | Needs `loadable-stats.json` |

`@loadable/webpack-plugin` was intentionally skipped in the rspack config because it has known compatibility issues with Rspack v2 (see web-infra-dev/rspack#12606). All Client pages depend on `loadable-stats.json` for chunk extraction and fail with a clean rspack build. (Restaurant Client appeared to work in dev mode only because a stale `loadable-stats.json` from a prior webpack build was still present.)

## Known issues

1. **`@loadable/webpack-plugin` not included** — SSR/Client pages may break if `loadable-stats.json` becomes stale
2. **`__dirname` warnings** — 4 `.server.tsx` files produce harmless `__dirname` mocked warnings
3. **`require('@rspack/core')` experimental warning** — Node 22 shows an ESM compat warning (harmless)
4. **Shakapacker supplemental packages** — Shakapacker 10.1 adds optional `shakapacker-webpack` and `shakapacker-rspack` packages that can simplify managed bundler dependencies. This demo keeps explicit webpack and rspack dependencies because it exercises both bundlers side-by-side.

## Bundle size comparison

Measured by fetching each page's HTML from the running Rails server, extracting `<script>` and `<link>` tags pointing to `/packs/`, and summing the actual file sizes from disk. Gzip sizes computed with `gzip -c`. Both bundlers use SWC transpilation via shakapacker. All measurements are **production builds** (minified).

### Fixes applied

Shakapacker's `generateRspackConfig()` is missing two optimization settings that `generateWebpackConfig()` includes by default:

1. **`optimization.splitChunks.chunks = 'all'`** — Without this, vendor code isn't extracted into shared chunks.
2. **`optimization.runtimeChunk = 'single'`** — Without this, rspack creates a separate runtime per entry point, preventing vendor chunks from being shared across entries with different runtimes. This caused `react-dom-client.production.js` (536 KB) to be duplicated across multiple chunks.

Both fixes are applied in `clientRspackConfig.js`.

### Per-page JS download (production, minified)

| Page | Rspack gzip | Webpack gzip | Diff |
|------|------------|-------------|------|
| Product RSC | **79 KB** | 80 KB | **-1%** |
| Product Search RSC | **76 KB** | 83 KB | **-9%** |
| Blog RSC | 81 KB | 81 KB | **0%** |
| Blog RSC Simple | 81 KB | 81 KB | **0%** |
| Restaurant RSC | **76 KB** | 77 KB | **-2%** |
| Product SSR | **490 KB** | 494 KB | **-1%** |
| Product Search SSR | **389 KB** | 392 KB | **-1%** |
| Blog SSR | **381 KB** | 385 KB | **-1%** |
| Restaurant SSR | **481 KB** | 484 KB | **-1%** |

Client pages error under rspack (missing `@loadable/webpack-plugin`). CSS per page: rspack 90 KB vs webpack 112 KB (rspack smaller).

### Conclusion

With both `splitChunks.chunks = 'all'` and `runtimeChunk = 'single'`, **all RSC and SSR pages are at parity or slightly smaller** with rspack compared to webpack. The earlier +55-72% RSC overhead was entirely caused by the missing `runtimeChunk` config, not a tree-shaking difference. Combined with the **7.6x build speed improvement**, rspack is a clear win for this project.

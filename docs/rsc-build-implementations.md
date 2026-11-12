# RSC build implementations in this demo

This demo can build React Server Components with different plugin/loader implementations, selected by one generic environment variable:

```bash
RSC_BUILD_IMPLEMENTATION=<implementation-id>
```

If `RSC_BUILD_IMPLEMENTATION` is unset, the demo uses the released `react-on-rails-rsc` plugin and loader.

See also:

- [`docs/rsc-build-implementation-page-asset-comparison.md`](./rsc-build-implementation-page-asset-comparison.md) for the browser-level transferred JS/CSS comparison between `release` and `module_graph`.
- [`docs/rsc-route-entry-size-comparison.md`](./rsc-route-entry-size-comparison.md) for the route-entry build-artifact JS/CSS comparison between `release` and `route_entry`.

Current implementations:

- `release`: released `react-on-rails-rsc` plugin + loader
- `module_graph`: local webpack-only experimental plugin + local loader wrapper based on issue [#130](https://github.com/shakacode/react_on_rails_rsc/issues/130)
- `route_entry`: local webpack/rspack benchmark implementation based on issue [#131](https://github.com/shakacode/react_on_rails_rsc/issues/131)

## Why this exists

Issues #130 and #131 ask whether graph-driven RSC builds can do a better job than the released chunk-driven plugin at:

1. finding client boundaries,
2. associating CSS with the right component,
3. mapping a component to only the chunks it actually needs.

This demo wires the implementations behind one switch so the same app can be bundled multiple ways and compared with the same pages.

## What this demo actually changes

The selector lives in `config/rsc-implementations/index.js`.

Webpack and rspack configs now ask that registry for:

- which plugin to instantiate
- which RSC loader path to use

The CSS demo server views also changed:

- first try manifest-driven server-component CSS
- if none exists, fall back to the existing carrier-pack CSS entries

That keeps the released path working while letting the experimental path prove end-to-end server-component CSS delivery.

## Algorithm comparison

### `release`

This is the released `react-on-rails-rsc` behavior:

1. Scan the configured `clientReferences` directories for files containing `"use client"`.
2. Inject one `AsyncDependenciesBlock` per discovered client reference onto the Flight client runtime.
3. Let webpack create chunk groups from those async blocks.
4. Build the client manifest by reading `chunk.files` from those chunk groups.
5. Recover some missing CSS with a one-level sibling CSS walk.

In simple terms: start from the chunks, then ask "which JS and CSS files landed in this chunk?"

### `module_graph`

This branch implementation is still a hybrid, not the full issue target:

1. It still discovers client references with the configured directory scan.
2. It still injects `AsyncDependenciesBlock`s the same way.
3. It still uses chunk-group-based JS mapping for client references.
4. It changes CSS association to a recursive module-graph walk:
   - start from a module
   - walk `moduleGraph.getOutgoingConnections(...)`
   - keep descending through JS intermediaries
   - stop when CSS modules are reached
   - map those CSS modules to output files through `chunkGraph.getModuleChunksIterable(...)`
5. It emits a new `serverComponentCss` manifest bucket for server-rendered components.

In simple terms: JS is still mostly chunk-driven here, but CSS becomes module-driven.

### `route_entry`

This branch implementation is benchmark-only and models issue #131's route-entry idea:

1. Search the source tree for directories named by `RSC_ROUTE_ENTRY_DIRECTORY`.
   The default is `startup`, matching React on Rails auto-bundling conventions.
2. Treat every source file inside those directories as a server-component route root.
3. Walk each route root's static relative import graph.
4. Stop when a module has a top-level `"use client"` directive. That module is a
   client boundary for the route.
5. Keep walking through server modules and collect CSS imports in import order.
6. Generate one client-side route entry under `tmp/rsc-route-entry-experiment/`
   per route. The generated entry imports:
   - server-component CSS discovered before client-boundary cuts;
   - discovered client boundary modules.
7. Add those generated entries to the client bundler config.
8. Emit `react-rsc-route-entry-manifest.json` from client and server builds for
   benchmarking.

In simple terms: start from each route root, cut the graph at client boundaries,
then let webpack/rspack build one browser entry for the route-discovered client
and CSS surface.

### Full issue #130 target vs this branch

Issue #130 proposes more than what is implemented here:

- graph-walk client boundary discovery from server roots
- a second client-only graph walk for nested client boundaries
- possibly content-addressed boundary ids
- more precise component-to-JS-chunk mapping experiments

This branch does **not** implement those parts yet. In this demo, the meaningful change is CSS association and server-component CSS emission.

## Visual model

### Released path

```text
clientReferences scan
        |
        v
"use client" files
        |
        v
AsyncDependenciesBlock per file
        |
        v
webpack chunk groups
        |
        v
read chunk.files
        |
        +--> client manifest JS
        |
        +--> client manifest CSS (chunk-driven)

server component CSS:
  not tracked in manifest
  -> demo falls back to carrier packs
```

### Experimental `module_graph` path in this branch

```text
clientReferences scan
        |
        v
"use client" files
        |
        v
AsyncDependenciesBlock per file
        |
        v
webpack chunk groups
        |
        +--> client manifest JS (same chunk-group strategy as release)
        |
        +--> for each component:
                walk module graph recursively
                -> find CSS leaf modules
                -> map CSS module -> output CSS files
                -> emit exact CSS list
        |
        +--> emit serverComponentCss for server-rendered components

demo view:
  startup file -> real component module -> manifest CSS -> <link> tags in <head>
```

## Measured output in this demo

Commands used:

```bash
mise exec -- bundle exec rake react_on_rails:generate_packs
mise exec -- pnpm build:production
pnpm report:rsc:manifest

RSC_BUILD_IMPLEMENTATION=module_graph mise exec -- pnpm build:production
pnpm report:rsc:manifest
```

### Release manifest summary

```json
{
  "clientReferenceCount": 58,
  "jsChunkReferenceCount": 165,
  "cssReferenceCount": 0,
  "serverComponentCssEntryCount": 0,
  "cssDemoServerEntries": []
}
```

### `module_graph` manifest summary

```json
{
  "clientReferenceCount": 58,
  "jsChunkReferenceCount": 165,
  "cssReferenceCount": 7,
  "serverComponentCssEntryCount": 12,
  "cssDemoServerEntries": [
    {
      "component": "CssPageOneServerCss",
      "manifestKey": "file:///.../app/javascript/components/css-demo/CssPageOne.tsx",
      "css": [
        "/packs/css/7981-3a1507d5.css",
        "/packs/css/1257-a69cd470.css"
      ]
    },
    {
      "component": "CssPageTwoServerCss",
      "manifestKey": "file:///.../app/javascript/components/css-demo/CssPageTwo.tsx",
      "css": [
        "/packs/css/7981-3a1507d5.css",
        "/packs/css/5408-948f74f0.css"
      ]
    }
  ]
}
```

What that means:

- JS reference counts are unchanged in this branch implementation.
- Client-reference CSS now appears in the manifest.
- Server-component CSS now appears in the manifest.
- The CSS demo pages can use exact manifest-derived server CSS instead of carrier packs.

## End-to-end verification

Both modes were verified against the running Rails app with:

```bash
BASE=http://127.0.0.1:5000 node scripts/verify-css-demo-server-css.mjs
```

Observed result:

- `release`: passed via carrier-pack fallback
- `module_graph`: passed via manifest-derived server-component CSS

The script verifies that:

- CSS is linked in `<head>`
- page one gets `cssShared + cssA`
- page two gets `cssShared + cssB`
- neither page downloads the other page's CSS
- no carrier-pack JavaScript is shipped

## Current limitations

- `module_graph` is webpack-only in this demo. Selecting it for rspack fails fast.
- `module_graph` still uses released client-reference discovery and released JS chunk mapping.
- The emitted `serverComponentCss` bucket still contains some synthetic generated-pack entries; the demo helper resolves startup files to the underlying component module first so the page uses the precise entry instead of the noisy one.
- `route_entry` uses a demo-local static import resolver, not a final webpack/rspack
  `moduleGraph` implementation.
- `route_entry` follows relative static imports and exports. It does not resolve
  arbitrary package imports, path aliases, or runtime-generated import strings.
- `route_entry` emits benchmark route entries and a benchmark manifest. Rails views
  do not yet link those route entries as the real page assets.

## Useful commands

Build with released plugin/loader:

```bash
mise exec -- pnpm build:production
```

Build with the experimental branch implementation:

```bash
RSC_BUILD_IMPLEMENTATION=module_graph mise exec -- pnpm build:production
```

Build with the route-entry benchmark implementation:

```bash
RSC_BUILD_IMPLEMENTATION=route_entry mise exec -- pnpm build:production
```

Inspect the current manifest:

```bash
pnpm report:rsc:manifest
```

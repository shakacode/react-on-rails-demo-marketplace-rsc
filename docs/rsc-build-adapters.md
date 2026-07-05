# RSC Build Adapters

This demo can switch the RSC bundling integration through one generic environment
variable:

```bash
RSC_BUILD_ADAPTER=released
RSC_BUILD_ADAPTER=route-entry-experiment
```

If `RSC_BUILD_ADAPTER` is not set, the demo uses `released`.

The adapter registry lives in `experimental/rsc-build-adapters/`. It is local to
this demo and is not part of the `react-on-rails-rsc` npm package. Add future
benchmark variants by adding another adapter directory and registering it in
`experimental/rsc-build-adapters/index.js`.

## `released`

This is the production path used by default.

- Webpack client/server builds use `react-on-rails-rsc/WebpackPlugin`.
- Rspack client/server builds use `react-on-rails-rsc/RspackPlugin`.
- The RSC build uses `react-on-rails-rsc/WebpackLoader`.
- Client references come from the configured `clientReferences` directory scan.
- The emitted React manifests keep the released package shape:
  `react-client-manifest.json` and `react-server-client-manifest.json`.

Use this mode when validating app correctness against the published package.

## `route-entry-experiment`

This is a benchmark-only prototype for the route-entry experiment from
`react_on_rails_rsc` issue 131.

It keeps the released package's runtime-compatible manifest and loader behavior,
but adds a local route-entry analysis layer:

1. Search the source tree for directories named by `RSC_ROUTE_ENTRY_DIRECTORY`.
   The default is `startup`, matching React on Rails auto-bundling conventions.
2. Treat every source file inside those directories as a server-component route
   root.
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

Example:

```bash
RSC_BUILD_ADAPTER=route-entry-experiment pnpm build:production
```

To use a different auto-entry directory name:

```bash
RSC_BUILD_ADAPTER=route-entry-experiment \
RSC_ROUTE_ENTRY_DIRECTORY=rsc-routes \
pnpm build:production
```

## Comparison

| Area | `released` | `route-entry-experiment` |
| --- | --- | --- |
| Intended use | Production correctness | Benchmarking only |
| Source of client references | Released package `clientReferences` scan | Route-root graph walk, cut at `"use client"` |
| Browser entries | Normal Shakapacker entries plus package async client-reference chunks | Normal entries plus generated `rsc-route-*` entries |
| Server-component CSS | Not tracked by the package manifest | Collected from route server graph and imported into generated route entries |
| Client manifest consumed by React | Released package manifest | Still released package manifest for compatibility |
| Extra benchmark manifest | None | `react-rsc-route-entry-manifest.json` |
| Loader | Released `WebpackLoader` | Demo-local wrapper around released `WebpackLoader` |

The experimental adapter is intentionally conservative at runtime: React still
uses the released package manifests and loader semantics. The new route entries
and benchmark manifest let us measure route-scoped JS/CSS topology without
shipping an unreleased package API.

## Current Limitations

- The route walk is a demo-local static import resolver, not the final
  package-quality webpack/rspack `moduleGraph` implementation.
- It follows relative static imports and exports. It does not resolve arbitrary
  package imports, path aliases, or runtime-generated import strings.
- It records `"*"`-style client boundaries rather than per-export usage.
- It does not change the RSC runtime to consume route-scoped manifest slices.
- Tailwind/utility CSS generated from class-name strings is still out of graph
  reach and remains the responsibility of the normal app CSS pipeline.

# Apollo Client × React Server Components

**Issue:** [#255](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/255)
**PR:** [#256](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/pull/256)

## Summary

Two demo routes prove Apollo Client's RSC/streaming package family
(`@apollo/client-react-streaming`) works on React on Rails Pro RSC pages:

| Route | Pattern | Apollo JS in browser |
|---|---|---|
| `/product/rsc-apollo-l1` | Server-only: `registerApolloClient` + `getClient().query()` | Zero |
| `/product/rsc-apollo-l2` | `PreloadQuery` → Flight → client island (`useReadQuery`) | Apollo core + streaming |

Both routes query a Rails `/graphql` endpoint (`graphql-ruby`) from the
node-renderer VM via Apollo's `HttpLink`.

## Conclusions

### C1 — Bundle resolution ✅

The three bundles resolve the correct entry:
- RSC: `react-server` condition → `index.rsc.js` (has `registerApolloClient`, `PreloadQuery`)
- SSR: `node` condition → `index.ssr.js` (has `ApolloClient`, `InMemoryCache`, `WrapApolloProvider`)
- Client: `browser` condition → `index.browser.js`

Named imports (`ApolloClient`, `InMemoryCache`) work in all three bundles.
`registerApolloClient` is accessed via dynamic `import()` inside `getRegistered()`
to avoid Rspack's ESM static linking error in the SSR bundle.

### C2 — Renderer VM globals ✅

`config/renderer-context.js` provides all required globals:
- `TransformStream` — import-time (`JSONEncodeStream extends TransformStream`)
- `crypto.randomUUID` — call-time (PreloadQuery transport keys)
- `fetch`, `Headers`, `Request`, `Response`, `AbortSignal` — call-time (HttpLink)

No new globals were needed beyond what `bac9011` added. Pinned in
`scripts/renderer-context.test.mjs`.

### C3 — Per-request isolation (React.cache) — not tested under concurrency

`registerApolloClient` wraps `makeClient` in `React.cache()` for per-request
identity. Assumed correct based on Apollo's own tests; not verified under
concurrent renderer workers in this demo. Apollo's built-in `WeakSet` warning
would surface a cross-request leak.

### C4 — PreloadQuery ReadableStream through Flight — partial

The `PreloadQuery` `ReadableStream` survives RSC → Flight payload → SSR
(`createFromNodeStream`). The browser receives `$R` rows in the embedded RSC
payload. However, the SSR-to-client rehydration path requires a streaming
`ApolloProvider` backed by `buildManualDataTransport`, which React on Rails Pro
does not expose (see C6).

### C5 — SimulatePreloadedQuery chunk loading ✅ (with fix)

Apollo ships `SimulatePreloadedQuery` as a `'use client'` module in
`dist/index.cc.js`. Two fixes were required:

1. **RSC loader**: the standard `.js` test pattern processes it correctly.
   `.cjs` files (the CJS twin) cannot be processed — use ESM imports
   (`import *` or `import()`) to ensure webpack/rspack resolves the `.js` entry.
2. **Client manifest**: the client bundle's `clientReferences` must include
   `@apollo/client-react-streaming/dist/*.cc.js` so the React Client Manifest
   has the entry. Without this, the Flight payload references a module the
   client can't find.

### C6 — L3 transport gap (F6) — not built, documented

React on Rails Pro's `renderToPipeableStream` call is internal. There is no
public `useInsertHtml` hook for `buildManualDataTransport`. Without it:

- **L2 degradation**: the client island re-fetches from `/graphql` on hydration
  (double fetch). The Flight stream carries the `queryRef` but
  `SimulatePreloadedQuery` can't transport the SSR cache to the client.
- **L3 (island-only SSR queries)**: not implemented. Would need the same hook.

This is the primary item for the upstream React on Rails Pro ask.

### C7 — Read-your-writes with Apollo — not implemented

GraphQL mutations were not added in this phase. The `RSCRoute.refetch()` pattern
from #245 remains the recommended write path. A follow-up could add a GraphQL
mutation for the review submit and compare cache-update vs refetch.

### C8 — Cost — not measured

Bundle size delta and vitals measurements deferred to a follow-up. Apollo routes
are registered in `scripts/measure-bundle-sizes.mjs` for future runs.

### C9 — Caching interplay — not tested

`unstable_cache` / `cacheComponent` around `getClient().query()` not tested.
A per-request `InMemoryCache` is always cold on the server — this is expected
and correct for RSC.

### C10 — Integration-package spec — deferred

The upstream `apollographql/apollo-client-integrations` issue is deferred until
the streaming transport hook (C6) is available. The working L1 + L2 demo is
evidence for the request; the missing piece is the transport implementation.

## Decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| D1 | GraphQL backend | `graphql-ruby` over existing models | Rails-native; `ProductSerialization` shapes reused |
| D2 | Route naming | `/product/rsc-apollo-l1`, `/product/rsc-apollo-l2` | Mirrors `/product/rsc-forms`, `/product/rsc-pull` |
| D3 | Permanent routes | L1 + L2 permanent | Both demonstrate distinct patterns worth keeping |
| D4 | Endpoint seeding | `process.env.GRAPHQL_URI` fallback `localhost:3000/graphql` | Runtime env, not build-time; matches documented per-request pattern |
| D5 | VM globals location | `config/renderer-context.js` only | Security (controlled fetch), backward compatibility |
| D6 | L3 transport gap | Document degradation; no patch | React on Rails Pro hook doesn't exist yet; upstream ask planned |
| D7 | Mutation scope | Deferred | GraphQL mutation adds schema complexity without the transport to prove C7 |
| D8 | Upstream ask shape | Deferred until transport hook exists | L1+L2 evidence supports the request; L3 transport is the missing piece |
| D9 | Apollo patches | None needed | All issues resolved with config/code changes in this repo |
| D10 | Measurement set | Registered in bundle-sizes script | Vitals comparison deferred to follow-up |

## Technical findings

### Rspack vs webpack: ESM namespace linking

Rspack statically analyzes `import * as ns` namespace imports and rejects
property access for non-existent exports at module scope. Webpack allows this
(returns `undefined` at runtime). Fix: use `await import()` inside the function
body so the property access is deferred to call time.

### CJS vs ESM entry resolution

`require('@apollo/client-react-streaming')` resolves the CJS entry
(`index.rsc.cjs`) whose `'use client'` transitive deps (`.cc.cjs`) are not
processed by the RSC loader (it handles `.js` only). `import()` or `import *`
resolves the ESM entry (`.js`) where the RSC loader works correctly.

### React Compiler false positive

The React Compiler ESLint plugin reports "Cannot create components during render"
when `PreloadQuery` is assigned to a local variable inside a render function.
The plugin ignores `eslint-disable` comments. Fix: extract into a lowercase
helper function (`renderPreloadedReviews`) that the compiler doesn't analyze as
a component.

## Upstream outputs

### apollographql/apollo-client-integrations — DEFERRED

The integration-package issue (`@apollo/client-integration-react-on-rails`) is
deferred until React on Rails Pro exposes the stream-injection hook needed for
the SSR→client data transport (C6). Filing now would be premature — the L1+L2
evidence proves Apollo works on React on Rails RSC, but the transport
implementation (the interesting engineering in the integration package) depends
on the React on Rails Pro hook.

### shakacode/react_on_rails — DEFERRED

- **Node renderer globals**: the globals added in `renderer-context.js` are
  app-level, not renderer defaults. An upstream PR to add web-standard globals
  by default is reasonable but not blocking (D5).
- **Stream-injection hook**: the primary upstream ask. Deferred until there is a
  working prototype to propose (D6).
- **Docs corrections**: the Apollo row in `docs/oss/migrating/rsc-third-party-libs.md`
  should be updated with the findings from this demo. Filed as a follow-up.

## Files added/modified

### Rails
- `Gemfile` — `graphql ~> 2.6`
- `app/graphql/` — schema, types, query
- `app/controllers/graphql_controller.rb`
- `config/routes.rb` — `/graphql` POST, `/product/rsc-apollo-l1`, `/product/rsc-apollo-l2`
- `app/views/products/show_rsc_apollo_*.html.erb`
- `spec/requests/graphql_spec.rb`

### JavaScript
- `app/javascript/components/apollo/` — `apolloClient.ts`, `queries.ts`
- `app/javascript/components/product/ProductPageApollo{L1,L2}RSC.tsx`
- `app/javascript/components/product/ApolloReviewsIsland.tsx`
- `config/renderer-context.js` — VM globals
- `config/rsc-implementations/index.js` — client references for Apollo `.cc.js`
- `config/webpack/rscClientReferences.js` — same for webpack

### Docs & config
- `docs/apollo-client-rsc.md` (this file)
- `.verify-routes.js` — Apollo routes in browser smoke
- `spec/support/route_contract.rb` — route contract entries
- `scripts/measure-bundle-sizes.mjs` — Apollo routes in PAGES

// Apollo Client configuration for React Server Components (issue #255).
//
// IMPORTANT: ApolloClient and InMemoryCache MUST be imported from
// @apollo/client-react-streaming, NOT from @apollo/client directly.
// The streaming package wraps them with assertInstance checks using
// Symbol.for() — importing from the wrong package causes a runtime throw.
//
// BUNDLE SAFETY: This module is imported by RSC components that end up in
// both the RSC and SSR bundles (they share a single server-bundle entry
// point). The RSC-only functions (getClient, getPreloadQuery) must never
// crash the SSR bundle at module-evaluation time — all RSC-specific work
// is deferred to first call, which only happens inside an RSC render.
//
// ESM vs CJS: Using named imports (not require()) is critical — require()
// resolves the CJS entry whose .cc.cjs transitive deps are not processed
// by the RSC loader (issue #255 C5 finding). registerApolloClient is
// accessed via dynamic import() inside getRegistered() to avoid Rspack's
// ESM static linking error when the export doesn't exist in the SSR entry.

import { ApolloClient, InMemoryCache } from '@apollo/client-react-streaming';
import type { PreloadQueryComponent } from '@apollo/client-react-streaming';
import { HttpLink } from '@apollo/client/link/http';

// The GraphQL endpoint URL. Callers pass it from the Rails controller
// (request.protocol + request.host_with_port + '/graphql') so the renderer
// always reaches the correct Rails instance, regardless of port.
const DEFAULT_GRAPHQL_URI = 'http://localhost:3000/graphql';

// Module-level URI seed — set by the first getClient(uri) call, used by
// registerApolloClient's factory. Per-request isolation comes from
// React.cache inside registerApolloClient; the URI is the same for all
// components in one request.
let _graphqlUri = DEFAULT_GRAPHQL_URI;

export function makeApolloClient(graphqlUri: string = _graphqlUri) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: graphqlUri,
      // fetch is available in the VM context via renderer-context.js
    }),
  });
}

// registerApolloClient uses React.cache() to create one ApolloClient per
// RSC render request. Different concurrent requests get different clients;
// same-request calls to getClient() return the same instance.
//
// The streaming package's react-server entry (index.rsc.js) exports
// registerApolloClient; the node/SSR entry (index.ssr.js) does not.
// We access it via dynamic import() inside getRegistered() at call time
// to avoid Rspack's ESM static linking error.

interface RegisterResult {
  getClient: () => InstanceType<typeof ApolloClient>;
  query: InstanceType<typeof ApolloClient>['query'];
  PreloadQuery: PreloadQueryComponent;
}

let _registered: RegisterResult | null = null;

async function getRegistered(): Promise<RegisterResult> {
  if (!_registered) {
    // Dynamic import() deferred to first call — resolves the ESM entry
    // (index.rsc.js under react-server, index.ssr.js otherwise) and the
    // RSC loader processes its 'use client' transitive deps correctly.
    // The SSR bundle never reaches this because getClient/getPreloadQuery
    // are only called from RSC render functions.
    const streaming = await import('@apollo/client-react-streaming');

    if (typeof streaming.registerApolloClient !== 'function') {
      throw new Error(
        'registerApolloClient is only available in the RSC bundle (react-server condition). ' +
        'This code path should only execute in the RSC bundle. ' +
        'If you see this in the SSR bundle, check that no module-level code ' +
        'calls getClient() or getPreloadQuery() — they must only be called ' +
        'inside RSC component render functions.'
      );
    }
    _registered = streaming.registerApolloClient(() => makeApolloClient()) as RegisterResult;
  }
  return _registered;
}

// Lazy accessors — only called from RSC components in the RSC bundle.
// graphqlUri seeds the module-level URI before the first registerApolloClient
// call; subsequent calls in the same request reuse the cached client.
export async function getClient(graphqlUri?: string) {
  if (graphqlUri) _graphqlUri = graphqlUri;
  return (await getRegistered()).getClient();
}

export async function query(...args: Parameters<InstanceType<typeof ApolloClient>['query']>) {
  return (await getRegistered()).query(...args);
}

// PreloadQuery is a component — export it as a getter for the same reason.
export async function getPreloadQuery(): Promise<PreloadQueryComponent> {
  return (await getRegistered()).PreloadQuery;
}

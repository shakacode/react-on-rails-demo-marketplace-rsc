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

import { ApolloClient, InMemoryCache } from '@apollo/client-react-streaming';
import type { PreloadQueryComponent } from '@apollo/client-react-streaming';
import { HttpLink } from '@apollo/client/link/http';

// The GraphQL endpoint URL. In the node-renderer VM, this defaults to the
// Rails server's internal address. Configurable via the GRAPHQL_URI runtime
// environment variable in the node-renderer process (e.g. Docker, CI, or
// production). This is NOT a build-time DefinePlugin replacement — it reads
// process.env at runtime inside the VM.
const DEFAULT_GRAPHQL_URI =
  (typeof process !== 'undefined' && process.env?.GRAPHQL_URI) || 'http://localhost:3000/graphql';

export function makeApolloClient(graphqlUri: string = DEFAULT_GRAPHQL_URI) {
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
// We defer the require() + registration to first call so module evaluation
// in the SSR bundle has zero side effects from this code path.

interface RegisterResult {
  getClient: () => InstanceType<typeof ApolloClient>;
  query: InstanceType<typeof ApolloClient>['query'];
  PreloadQuery: PreloadQueryComponent;
}

let _registered: RegisterResult | null = null;

function getRegistered(): RegisterResult {
  if (!_registered) {
    // Dynamic require deferred to first call — the SSR bundle never reaches
    // this because getClient/getPreloadQuery are only called from RSC render
    // functions, which only execute in the RSC bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const streaming = require('@apollo/client-react-streaming');

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
export function getClient() {
  return getRegistered().getClient();
}

export function query(...args: Parameters<InstanceType<typeof ApolloClient>['query']>) {
  return getRegistered().query(...args);
}

// PreloadQuery is a component — export it as a getter for the same reason.
export function getPreloadQuery(): PreloadQueryComponent {
  return getRegistered().PreloadQuery;
}

// Apollo Client configuration for React Server Components (issue #255).
//
// IMPORTANT: ApolloClient and InMemoryCache MUST be imported from
// @apollo/client-react-streaming, NOT from @apollo/client directly.
// The streaming package wraps them with assertInstance checks using
// Symbol.for() — importing from the wrong package causes a runtime throw.
//
// NOTE: registerApolloClient and PreloadQuery are only exported from the
// react-server condition entry (index.rsc.js). In the SSR bundle (node
// condition), they are not available. This module is imported by RSC
// components that are bundled into both RSC and SSR bundles, but only
// EXECUTED in the RSC bundle. The SSR bundle includes them as dead code
// for registration purposes.

import { ApolloClient, InMemoryCache } from '@apollo/client-react-streaming';
import { HttpLink } from '@apollo/client/link/http';

// The GraphQL endpoint URL. In the node-renderer VM, this defaults to
// the Rails server's internal address. Configurable via GRAPHQL_URI at
// build time (webpack/Rspack DefinePlugin) for Docker, CI, or production.
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
// This dynamic require avoids the Rspack ESM linking error in the SSR bundle
// where registerApolloClient is not exported (node condition resolves to
// index.ssr.js). The RSC bundle (react-server condition → index.rsc.js)
// resolves it correctly at runtime.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _streaming = require('@apollo/client-react-streaming');

type RegisterResult = {
  getClient: () => InstanceType<typeof ApolloClient>;
  query: (...args: any[]) => Promise<any>;
  PreloadQuery: React.FC<any>;
};

let _registered: RegisterResult | null = null;

function getRegistered(): RegisterResult {
  if (!_registered) {
    if (typeof _streaming.registerApolloClient !== 'function') {
      throw new Error(
        'registerApolloClient is only available in the RSC bundle (react-server condition). ' +
        'This code path should only execute in the RSC bundle.'
      );
    }
    _registered = _streaming.registerApolloClient(() => makeApolloClient());
  }
  return _registered;
}

// Lazy accessors — only called from RSC components in the RSC bundle.
export function getClient() {
  return getRegistered().getClient();
}

export async function query(...args: any[]) {
  return getRegistered().query(...args);
}

// PreloadQuery is a component — export it as a getter for the same reason.
export function getPreloadQuery() {
  return getRegistered().PreloadQuery;
}

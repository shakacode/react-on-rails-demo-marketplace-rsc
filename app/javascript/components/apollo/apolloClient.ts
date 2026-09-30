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

// Namespace import so webpack resolves the ESM entry (index.rsc.js under
// react-server condition, index.ssr.js otherwise). In the RSC bundle,
// `streaming.registerApolloClient` exists; in the SSR bundle it's undefined.
// Using `import *` instead of `require()` is critical: require() would
// resolve the CJS entry whose .cc.cjs transitive deps are not processed by
// the RSC loader (issue #255 C5 finding).
import * as streaming from '@apollo/client-react-streaming';
import type { PreloadQueryComponent } from '@apollo/client-react-streaming';
import { HttpLink } from '@apollo/client/link/http';

const { ApolloClient, InMemoryCache } = streaming;

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
// The namespace import resolves it as undefined in the SSR bundle, which
// is safe — getRegistered() is only called from RSC render functions.

interface RegisterResult {
  getClient: () => InstanceType<typeof ApolloClient>;
  query: InstanceType<typeof ApolloClient>['query'];
  PreloadQuery: PreloadQueryComponent;
}

let _registered: RegisterResult | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerApolloClient = (streaming as any).registerApolloClient as
  | ((makeClient: () => InstanceType<typeof ApolloClient>) => RegisterResult)
  | undefined;

function getRegistered(): RegisterResult {
  if (!_registered) {
    if (typeof registerApolloClient !== 'function') {
      throw new Error(
        'registerApolloClient is only available in the RSC bundle (react-server condition). ' +
        'This code path should only execute in the RSC bundle. ' +
        'If you see this in the SSR bundle, check that no module-level code ' +
        'calls getClient() or getPreloadQuery() — they must only be called ' +
        'inside RSC component render functions.'
      );
    }
    _registered = registerApolloClient(() => makeApolloClient());
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

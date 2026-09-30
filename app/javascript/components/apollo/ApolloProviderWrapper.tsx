'use client';

// Browser-side ApolloProvider for L2 client islands (issue #255).
//
// SimulatePreloadedQuery calls useApolloClient() internally, which requires
// an ApolloProvider ancestor. This wrapper creates a browser-only ApolloClient
// with an HttpLink to /graphql (relative — works for any host) and wraps
// children in ApolloProvider.
//
// The ApolloClient and InMemoryCache MUST come from @apollo/client-react-streaming
// to satisfy the assertInstance check.

import React from 'react';
import { ApolloClient, InMemoryCache } from '@apollo/client-react-streaming';
import { ApolloProvider } from '@apollo/client/react';
import { HttpLink } from '@apollo/client/link/http';

function makeBrowserClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: '/graphql',
    }),
  });
}

// Singleton browser client — safe because this is a 'use client' component
// that only runs in the browser (one user, one tab).
let browserClient: InstanceType<typeof ApolloClient> | null = null;

function getBrowserClient() {
  if (!browserClient) {
    browserClient = makeBrowserClient();
  }
  return browserClient;
}

export function ApolloProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={getBrowserClient()}>
      {children}
    </ApolloProvider>
  );
}

// Apollo Client configuration for React Server Components (issue #255).
//
// IMPORTANT: ApolloClient and InMemoryCache MUST be imported from
// @apollo/client-react-streaming, NOT from @apollo/client directly.
// The streaming package wraps them with assertInstance checks using
// Symbol.for() — importing from the wrong package causes a runtime throw.

import { registerApolloClient, ApolloClient, InMemoryCache } from '@apollo/client-react-streaming';
import { HttpLink } from '@apollo/client/link/http';

// The GraphQL endpoint URL is constructed from railsContext at render time
// to match the current Rails host/port. During RSC rendering in the
// node-renderer VM, this defaults to the Rails server's internal address.
const DEFAULT_GRAPHQL_URI = 'http://localhost:3000/graphql';

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
export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return makeApolloClient();
});

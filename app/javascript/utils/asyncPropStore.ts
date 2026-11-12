// Request-scoped async prop store for pull-mode RSC pages (#165).
//
// Uses React.cache() to create a per-RSC-request singleton. This eliminates
// prop drilling of `getReactOnRailsAsyncProp` — instead of threading the
// function through every component, the root component calls
// `initAsyncPropStore()` once and children import `getAsyncProp()` directly.
//
// Concurrency-safe: React.cache() is request-scoped via React's internal
// AsyncLocalStorage. Two concurrent RSC renders never share cache entries.
//
// Server-only: React.cache() memoizes in the RSC server bundle. In client
// builds it's a pass-through (no memoization), but this module is only
// imported by server components so it never runs on the client.

import { cache } from 'react';

type GetAsyncProp = (propName: string) => Promise<any>;

interface AsyncPropStoreState {
  accessor: GetAsyncProp | null;
}

// cache() with no args = per-request singleton.
// Returns the SAME mutable object within a single RSC request.
// Different requests get different objects (React.cache is request-scoped).
const getStore = cache((): AsyncPropStoreState => ({ accessor: null }));

/**
 * Initialize the async prop store for the current request.
 * Must be called once by the root component during render, before any child
 * component calls `getAsyncProp()`.
 *
 * @example
 * ```tsx
 * export default function MyPageRSC({ product, getReactOnRailsAsyncProp }) {
 *   initAsyncPropStore(getReactOnRailsAsyncProp);
 *   return <AsyncChild />;
 * }
 * ```
 */
export function initAsyncPropStore(accessor: GetAsyncProp): void {
  getStore().accessor = accessor;
}

/**
 * Get an async prop by name. The prop must have been registered via
 * `stream_react_component_with_async_props` in the Rails view.
 *
 * In pull mode (`push_props: []`), calling this triggers a `propRequest` to
 * Rails, which queries the DB and streams the result back. When the calling
 * component is wrapped in `cacheComponent` / `unstable_cache`, a cache HIT
 * means the component function never runs — so this function is never called
 * — so no propRequest is sent — so no DB query runs.
 *
 * @example
 * ```tsx
 * import { getAsyncProp } from '../../utils/asyncPropStore';
 *
 * export default async function AsyncReviewsRSC() {
 *   const data = await getAsyncProp('reviews');
 *   return <ReviewsList reviews={data.reviews} />;
 * }
 * ```
 */
export function getAsyncProp(propName: string): Promise<any> {
  const store = getStore();
  if (!store.accessor) {
    throw new Error(
      `getAsyncProp('${propName}') called before initAsyncPropStore(). ` +
      'Ensure the root component calls initAsyncPropStore(getReactOnRailsAsyncProp) before rendering children.',
    );
  }
  return store.accessor(propName);
}

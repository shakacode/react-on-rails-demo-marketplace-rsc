// Conditionally applies `unstable_cache` from react-on-rails-pro based on the
// RSC_CACHE_ENABLED env var (injected at webpack build time via DefinePlugin).
// When disabled (default), the component function is returned as-is — a plain
// async server component with no caching overhead.

import { unstable_cache } from 'react-on-rails-pro/cache'; // eslint-disable-line camelcase

interface CacheOptions {
  id: string;
  revalidate?: number;
}

type AsyncComponent<P> = (props: P) => Promise<React.ReactElement | null>;

export function cacheComponent<P extends Record<string, unknown>>(
  fn: AsyncComponent<P>,
  options: CacheOptions,
): AsyncComponent<P> {
  if (process.env.RSC_CACHE_ENABLED === 'true') {
    return unstable_cache(fn, options) as AsyncComponent<P>;
  }
  return fn;
}


import {
  registerCacheHandler,
  RedisCacheHandler,
  TieredCacheHandler,
} from 'react-on-rails-pro/cache';
import type { CacheEntry, CacheHandler } from 'react-on-rails-pro/cache';

declare const __GET_REDIS_URL__: (() => string) | undefined;
declare const __GET_SHARED_REDIS_CACHE__: ((createHandler: () => CacheHandler) => CacheHandler) | undefined;

const parsedL1MaxEntries = Number(process.env.RSC_L1_CACHE_MAX_ENTRIES);
const DEFAULT_L1_MAX_ENTRIES = Number.isInteger(parsedL1MaxEntries) && parsedL1MaxEntries > 0
  ? parsedL1MaxEntries
  : 50;

class InMemoryLRU implements CacheHandler {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;

  constructor(maxEntries = DEFAULT_L1_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    // react-on-rails-pro stores non-positive revalidate values without a TTL.
    const revalidate = entry.revalidate ?? 0;
    if (revalidate > 0 && Date.now() - entry.timestamp > revalidate * 1000) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    if (this.cache.has(key)) this.cache.delete(key);
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, entry);
  }
}

const redisUrl = typeof __GET_REDIS_URL__ === 'function' ? __GET_REDIS_URL__() : '';
const isRscBundle = process.env.REACT_ON_RAILS_RSC_BUNDLE === 'true';
// RSC_CACHE_ENABLED is baked into the bundle by webpack/rspack DefinePlugin.
const isRedisCacheEnabled = process.env.RSC_CACHE_ENABLED === 'true';

if (redisUrl && isRscBundle && isRedisCacheEnabled) {
  if (typeof __GET_SHARED_REDIS_CACHE__ !== 'function') {
    throw new Error('Redis fragment caching requires the renderer cache owner callback');
  }
  console.info('[RSC Cache] Tiered cache enabled (L1 in-memory + L2 Redis)');
  const l1 = new InMemoryLRU();
  const l2 = __GET_SHARED_REDIS_CACHE__(() => new RedisCacheHandler({ redisUrl }));
  registerCacheHandler('default', new TieredCacheHandler(l1, l2));
} else if (redisUrl && isRscBundle && !isRedisCacheEnabled) {
  console.warn(
    '[RSC Cache] REDIS_URL is set but RSC_CACHE_ENABLED was not true at bundle build time; RSC fragment caching is disabled',
  );
}

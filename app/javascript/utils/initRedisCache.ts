import {
  registerCacheHandler,
  RedisCacheHandler,
  TieredCacheHandler,
} from 'react-on-rails-pro/cache';
import type { CacheEntry, CacheHandler } from 'react-on-rails-pro/cache';

declare const __REDIS_URL__: string | undefined;

type RedisClosable = Partial<{
  close: () => unknown;
  disconnect: () => unknown;
  quit: () => unknown;
  redis: RedisClosable;
}>;

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

const redisUrl = typeof __REDIS_URL__ !== 'undefined' ? __REDIS_URL__ : '';
const isRscBundle = process.env.REACT_ON_RAILS_RSC_BUNDLE === 'true';
// RSC_CACHE_ENABLED is baked into the bundle by webpack/rspack DefinePlugin.
const isRedisCacheEnabled = process.env.RSC_CACHE_ENABLED === 'true';

function closeOnShutdown(handler: RedisClosable) {
  // rc.3 does not expose a public shutdown API; use the wrapped ioredis client
  // when present, and prefer a public handler method if upstream adds one later.
  const closeTarget = handler.quit || handler.disconnect || handler.close ? handler : handler.redis;
  const close = closeTarget?.quit ?? closeTarget?.disconnect ?? closeTarget?.close;
  if (!close) return;

  let closed = false;
  const closeRedis = () => {
    if (closed) return Promise.resolve();
    closed = true;
    const closeTimeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    return Promise.race([
      Promise.resolve(close.call(closeTarget)).catch((error) => {
        console.warn('[RSC Cache] Failed to close Redis connection', error);
      }),
      closeTimeout,
    ]);
  };

  process.once('SIGINT', () => {
    void closeRedis().finally(() => process.kill(process.pid, 'SIGINT'));
  });
  process.once('SIGTERM', () => {
    void closeRedis().finally(() => process.kill(process.pid, 'SIGTERM'));
  });
}

if (redisUrl && isRscBundle && isRedisCacheEnabled) {
  const safeUrl = redisUrl.replace(/:\/\/[^@]*@/, '://***@');
  console.info(`[RSC Cache] Tiered cache enabled (L1 in-memory + L2 Redis: ${safeUrl})`);
  const l1 = new InMemoryLRU();
  const l2 = new RedisCacheHandler({ redisUrl });
  closeOnShutdown(l2 as RedisClosable);
  registerCacheHandler('default', new TieredCacheHandler(l1, l2));
} else if (redisUrl && isRscBundle && !isRedisCacheEnabled) {
  console.warn(
    '[RSC Cache] REDIS_URL is set but RSC_CACHE_ENABLED was not true at bundle build time; using in-memory LRU',
  );
}

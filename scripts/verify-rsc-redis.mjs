import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import Redis from 'ioredis';

assert.ok(process.env.REDIS_URL, 'REDIS_URL is required for the shared-cache gate');
const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null,
});
redis.on('error', () => {});
try {
  await redis.connect();
  // Refresh an eligible fragment immediately before inspection: the longer
  // browser suite can legitimately outlast the fragment's revalidation window.
  const response = await fetch(new URL('/blog/rsc', process.env.BASE_URL), {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'the cache probe page must render');
  await response.arrayBuffer();
  let found = false;
  for (let attempt = 0; attempt < 30 && !found; attempt += 1) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'rorp:rsc-cache:*', 'COUNT', '100');
      cursor = next;
      found ||= keys.length > 0;
    } while (cursor !== '0' && !found);
    if (!found) await delay(100);
  }
  assert.ok(found, 'the running renderer must populate shared Redis fragment entries');
  console.log('Shared Redis fragment entries verified');
} finally {
  redis.disconnect();
}

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Redis from 'ioredis';
import webpack from 'webpack';
import addIoredisExternal from '../config/shared/addIoredisExternal.js';
import redisCacheOwnerModule from '../config/redis-cache-owner.js';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const { createRedisCacheOwner } = redisCacheOwnerModule;
assert.equal(
  spawnSync('redis-server', ['--version'], { env: { ...process.env, LC_ALL: 'C' } }).status,
  0,
  'Redis cache tests require redis-server on PATH',
);

async function until(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'operation must finish before the deadline');
    await delay(10);
  }
}

async function cacheFixture(t, { enabled = true, maxEntries = '2', password = 'disposable-cache-test' } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'marketplace-rsc-cache-'));
  const clients = [];
  class TrackedRedis extends Redis {
    constructor(...args) {
      super(...args);
      clients.push(this);
    }
  }
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  const server = spawn('redis-server', [
    '--bind', '127.0.0.1', '--port', String(port), '--save', '', '--appendonly', 'no',
    '--dir', directory, '--requirepass', password,
  ], { stdio: 'ignore', env: { ...process.env, LC_ALL: 'C' } });
  const redisUrl = `redis://:${password}@127.0.0.1:${port}`;
  const redis = new Redis(redisUrl, { retryStrategy: () => 20 });
  redis.on('error', () => {});
  t.after(async () => {
    clients.forEach((client) => client.disconnect());
    redis.disconnect();
    server.kill();
    await rm(directory, { recursive: true, force: true });
  });
  await until(() => {
    assert.equal(server.exitCode, null, 'isolated Redis server must start');
    return redis.status === 'ready';
  });

  // The public registry has a setter only. Read it inside the fixture to exercise
  // the installed initializer through the real CacheHandler get/set contract.
  const initializer = path.join(root, 'app/javascript/utils/initRedisCache.ts');
  const registry = path.join(root, 'node_modules/react-on-rails-pro/lib/cache/cacheHandlerRegistry.js');
  const entry = path.join(directory, 'entry.js');
  const initialize = process.env.RSC_CACHE_TEST_CONTROL !== 'true';
  await writeFile(entry, `${initialize ? `import ${JSON.stringify(initializer)};` : ''}
    export { getCacheHandler } from ${JSON.stringify(registry)};
    export { unstable_cache, registerCacheHandler } from 'react-on-rails-pro/cache';
  `);
  const compiler = webpack({
    mode: 'production', target: 'node', context: root, entry,
    output: { path: directory, filename: 'cache.cjs', library: { type: 'commonjs2' } },
    optimization: { minimize: false }, devtool: false,
    resolve: { extensions: ['.ts', '.js'], conditionNames: ['react-server', 'node', '...'],
      modules: [path.join(root, 'node_modules'), 'node_modules'] },
    module: { rules: [{ test: /\.ts$/, use: { loader: require.resolve('swc-loader'), options: {
      jsc: { parser: { syntax: 'typescript' } },
    } } }] },
    externals: addIoredisExternal(),
    plugins: [new webpack.DefinePlugin({
      'process.env.REACT_ON_RAILS_RSC_BUNDLE': JSON.stringify('true'),
      'process.env.RSC_CACHE_ENABLED': JSON.stringify(String(enabled)),
      'process.env.RSC_L1_CACHE_MAX_ENTRIES': JSON.stringify(maxEntries),
    })],
  });
  try {
    const stats = await new Promise((resolve, reject) => compiler.run((error, result) => (
      error ? reject(error) : resolve(result)
    )));
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  } finally {
    await new Promise((resolve) => compiler.close(resolve));
  }
  const code = await readFile(path.join(directory, 'cache.cjs'), 'utf8');

  function worker(url = redisUrl, getSharedRedisCache = createRedisCacheOwner(), bundleId = 'cache-fixture') {
    const workerProcess = { env: { NODE_ENV: 'production' } };
    const module = { exports: {} };
    const logs = [];
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: (name) => (name === 'ioredis' ? { default: TrackedRedis } : require(name)),
      Buffer, process: workerProcess,
      setTimeout, clearTimeout, setImmediate, clearImmediate,
      __GET_REDIS_URL__: () => url,
      __GET_SHARED_REDIS_CACHE__: getSharedRedisCache,
      __reactOnRailsProBundleId: bundleId,
      console: Object.fromEntries(['info', 'warn', 'error', 'debug'].map((level) => [
        level, (...args) => logs.push(args.join(' ')),
      ])),
    }, { filename: path.join(directory, 'cache.cjs') });
    return {
      handler: module.exports.getCacheHandler('default'), logs,
      cache: module.exports.unstable_cache, register: module.exports.registerCacheHandler,
    };
  }

  return { worker, redis, server };
}

const entry = (text, revalidate = 60) => ({
  value: [Buffer.from(text)], timestamp: Date.now(), revalidate,
});
const text = (cached) => cached?.value.map((chunk) => chunk.toString()).join('');

test('a fresh worker reuses a fragment cached by another worker', async (t) => {
  const fixture = await cacheFixture(t);
  const first = fixture.worker();
  await first.handler.set('shared-fragment', entry('rendered once'));
  const second = fixture.worker();
  assert.equal(text(await second.handler.get('shared-fragment')), 'rendered once');
});

test('without a Redis URL, workers retain separate in-memory caches', async (t) => {
  const fixture = await cacheFixture(t);
  const first = fixture.worker('');
  await first.handler.set('local-fragment', entry('local only'));
  assert.equal(text(await first.handler.get('local-fragment')), 'local only');
  assert.equal(await fixture.worker('').handler.get('local-fragment'), null);
  assert.equal(await fixture.redis.dbsize(), 0);
});

test('a disabled build flag leaves Redis unused and reports caching as disabled', async (t) => {
  const fixture = await cacheFixture(t, { enabled: false });
  const first = fixture.worker();
  await first.handler.set('disabled-fragment', entry('local handler'));
  assert.equal(await fixture.worker().handler.get('disabled-fragment'), null);
  assert.equal(await fixture.redis.dbsize(), 0);
  assert.match(first.logs.join('\n'), /fragment caching is disabled/);
});

test('L1 evicts the least recently read entry at its configured capacity', async (t) => {
  const fixture = await cacheFixture(t, { maxEntries: '2' });
  const { handler } = fixture.worker();
  await handler.set('a', entry('A'));
  await handler.set('b', entry('B'));
  await handler.get('a');
  await handler.set('c', entry('C'));
  await fixture.redis.del('a', 'b', 'c');
  assert.equal(await handler.get('b'), null);
  assert.equal(text(await handler.get('a')), 'A');
  assert.equal(text(await handler.get('c')), 'C');
});

test('promotion from Redis does not extend a fragment beyond its original expiry', async (t) => {
  const fixture = await cacheFixture(t);
  const cached = entry('short lived', 3);
  await fixture.worker().handler.set('expires', cached);
  await delay(600);
  const second = fixture.worker();
  assert.equal(text(await second.handler.get('expires')), 'short lived');
  await fixture.redis.del('expires');
  assert.equal(text(await second.handler.get('expires')), 'short lived', 'the promoted entry must be in L1');
  await delay(Math.max(0, cached.timestamp + 3100 - Date.now()));
  assert.equal(await second.handler.get('expires'), null);
});

test('Redis loss leaves local hits and subsequent local writes usable', async (t) => {
  const fixture = await cacheFixture(t);
  const { handler } = fixture.worker();
  await handler.set('before-outage', entry('already warm'));
  fixture.server.kill();
  await until(() => fixture.server.exitCode !== null || fixture.server.signalCode !== null);
  assert.equal(text(await handler.get('before-outage')), 'already warm');
  await handler.set('during-outage', entry('still renders'));
  assert.equal(text(await handler.get('during-outage')), 'still renders');
  assert.equal(await handler.get('missing'), null);
});

test('startup logging omits Redis URLs even with an at-sign in the password', async (t) => {
  const password = 'disposable-cache-test@tail';
  const fixture = await cacheFixture(t, { password });
  const { logs } = fixture.worker();
  assert.match(logs.join('\n'), /Tiered cache enabled/);
  assert.equal(logs.join('\n').includes('redis://'), false);
  assert.equal(logs.join('\n').includes(password), false);
});

test('several VM generations in one worker share one Redis connection', async (t) => {
  const fixture = await cacheFixture(t);
  const owner = createRedisCacheOwner();
  const first = fixture.worker(undefined, owner);
  await first.handler.set('generation', entry('saved'));
  for (let generation = 0; generation < 12; generation += 1) {
    const next = fixture.worker(undefined, owner);
    assert.equal(text(await next.handler.get('generation')), 'saved');
  }
  // One fixture inspector plus one shared worker connection.
  assert.match(await fixture.redis.info('clients'), /connected_clients:2\r?\n/);
});

test('cached fragment lookups are isolated by renderer bundle identity', async (t) => {
  const fixture = await cacheFixture(t);
  async function lookup(bundleId) {
    const context = fixture.worker('', undefined, bundleId);
    let observedKey;
    context.register('probe', {
      get: async (key) => { observedKey = key; throw new Error('observed backend lookup'); },
      set: async () => {},
    });
    await assert.rejects(
      context.cache(async () => null, { id: 'same-component', kind: 'probe' })(),
      /observed backend lookup/,
    );
    assert.equal(typeof observedKey, 'string');
    return observedKey;
  }
  const firstBuild = await lookup('bundle-a');
  assert.equal(await lookup('bundle-a'), firstBuild);
  assert.notEqual(await lookup('bundle-b'), firstBuild);
});

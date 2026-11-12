import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
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

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

async function until(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'operation must finish before the deadline');
    await delay(10);
  }
}

async function cacheFixture(t, { enabled = true, maxEntries = '2', password = 'disposable-cache-test' } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'marketplace-rsc-cache-'));
  const shutdown = [];
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
    await Promise.all(shutdown.map((close) => close()));
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
  `);
  const compiler = webpack({
    mode: 'production', target: 'node', context: root, entry,
    output: { path: directory, filename: 'cache.cjs', library: { type: 'commonjs2' } },
    optimization: { minimize: false }, devtool: false,
    resolve: { extensions: ['.ts', '.js'], conditionNames: ['react-server', 'node', '...'] },
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

  function worker(url = redisUrl) {
    const workerProcess = new EventEmitter();
    workerProcess.env = { NODE_ENV: 'production' };
    workerProcess.pid = 1;
    let stopped = false;
    workerProcess.kill = () => { stopped = true; };
    const module = { exports: {} };
    const logs = [];
    vm.runInNewContext(code, {
      module, exports: module.exports, require, Buffer, process: workerProcess,
      setTimeout, clearTimeout, setImmediate, clearImmediate,
      __GET_REDIS_URL__: () => url,
      console: Object.fromEntries(['info', 'warn', 'error', 'debug'].map((level) => [
        level, (...args) => logs.push(args.join(' ')),
      ])),
    }, { filename: path.join(directory, 'cache.cjs') });
    const hasShutdownHook = workerProcess.listenerCount('SIGTERM') > 0;
    const stop = async () => {
      if (hasShutdownHook && !stopped) {
        workerProcess.emit('SIGTERM');
        await until(() => stopped);
      }
    };
    shutdown.push(stop);
    return { handler: module.exports.getCacheHandler('default'), logs, stop };
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
  await fixture.worker().handler.set('expires', entry('short lived', 1));
  await delay(600);
  const second = fixture.worker();
  assert.equal(text(await second.handler.get('expires')), 'short lived');
  await delay(600);
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

test('shutdown closes the Redis connection before completing worker termination', async (t) => {
  const fixture = await cacheFixture(t);
  const context = fixture.worker();
  await context.handler.set('shutdown', entry('saved'));
  assert.match(await fixture.redis.info('clients'), /connected_clients:2\r?\n/);
  await context.stop();
  assert.match(await fixture.redis.info('clients'), /connected_clients:1\r?\n/);
  assert.equal(text(await fixture.worker().handler.get('shutdown')), 'saved');
});

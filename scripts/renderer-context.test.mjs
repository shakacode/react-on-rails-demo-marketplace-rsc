import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';
import rendererContextModule from '../config/renderer-context.js';

const { rendererAdditionalContext } = rendererContextModule;

test('renderer startup keeps Redis credentials out of its configuration logs', async (t) => {
  const password = 'disposable-renderer-cache-password';
  const child = spawn(process.execPath, ['node-renderer.js'], {
    cwd: new URL('..', import.meta.url), detached: true,
    env: {
      ...process.env, NODE_ENV: 'test', RENDERER_PORT: '0',
      RENDERER_WORKERS_COUNT: '1', REDIS_URL: `redis://:${password}@127.0.0.1:6379`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    process.kill(-child.pid, 'SIGTERM');
    await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, 'SIGKILL');
      await exited;
    }
  });
  const deadline = Date.now() + 10000;
  while (!output.includes('Final renderer settings')) {
    assert.ok(Date.now() < deadline, 'renderer must report its startup configuration');
    assert.equal(child.exitCode, null, 'renderer must start successfully');
    await delay(20);
  }
  assert.equal(output.includes(password), false, 'Redis credentials must stay out of renderer logs');
});

test('renderer VM context provides required web-platform globals', () => {
  const context = vm.createContext(rendererAdditionalContext);

  const requiredGlobals = {
    URL: 'function',
    AbortController: 'function',
    AbortSignal: 'function',
    performance: 'object',
    atob: 'function',
    btoa: 'function',
  };

  for (const [globalName, expectedType] of Object.entries(requiredGlobals)) {
    assert.equal(
      vm.runInContext(`typeof ${globalName}`, context),
      expectedType,
      `${globalName} must be available to server-rendered packages`,
    );
  }
});

test('renderer VM context provides Apollo RSC globals', () => {
  const context = vm.createContext(rendererAdditionalContext);

  // TransformStream — required at import time for JSONEncodeStream extends TransformStream
  assert.equal(
    vm.runInContext('typeof TransformStream', context),
    'function',
    'TransformStream must be available for Apollo stream-utils class declarations',
  );

  // crypto.randomUUID — required at call time for PreloadQuery transport keys
  assert.equal(
    vm.runInContext('typeof crypto', context),
    'object',
    'crypto must be available as an object',
  );
  assert.equal(
    vm.runInContext('typeof crypto.randomUUID', context),
    'function',
    'crypto.randomUUID must be available for PreloadQuery',
  );
  const uuid = vm.runInContext('crypto.randomUUID()', context);
  assert.match(uuid, /^[0-9a-f]{8}-/, 'crypto.randomUUID() must return a valid UUID');

  // fetch suite — required at call time for HttpLink
  assert.equal(
    vm.runInContext('typeof fetch', context),
    'function',
    'fetch must be available for Apollo HttpLink',
  );
  assert.equal(
    vm.runInContext('typeof Headers', context),
    'function',
    'Headers must be available for Apollo HttpLink',
  );
  assert.equal(
    vm.runInContext('typeof Request', context),
    'function',
    'Request must be available for Apollo HttpLink',
  );
  assert.equal(
    vm.runInContext('typeof Response', context),
    'function',
    'Response must be available for Apollo HttpLink',
  );
});

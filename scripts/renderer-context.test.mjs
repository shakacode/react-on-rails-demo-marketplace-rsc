import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import rendererContextModule from '../config/renderer-context.js';

const { rendererAdditionalContext } = rendererContextModule;

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

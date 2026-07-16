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

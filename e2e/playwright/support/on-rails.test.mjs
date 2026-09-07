import assert from 'node:assert/strict';
import test from 'node:test';

const probeToken = 'unit-probe-token-'.padEnd(64, 'x');

process.env.E2E_BASE_URL = 'http://e2e.invalid';
process.env.E2E_RAILS_TOKEN = probeToken;

test('posts Rails commands with native fetch', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  /** @type {RequestInfo | URL | undefined} */
  let receivedInput;
  /** @type {RequestInit | undefined} */
  let receivedInit;
  globalThis.fetch = async (input, init) => {
    receivedInput = input;
    receivedInit = init;
    return new Response(JSON.stringify({ products: 0 }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  };

  const { app } = await import('./on-rails.mjs');

  assert.deepEqual(await app('clean'), { products: 0 });
  assert.equal(receivedInput, 'http://e2e.invalid/__e2e__/command');
  assert.equal(receivedInit?.method, 'POST');
  assert.deepEqual(receivedInit?.headers, {
    'Content-Type': 'application/json',
    'X-E2E-Rails-Token': probeToken,
  });
  assert.equal(receivedInit?.body, JSON.stringify({ name: 'clean' }));

  globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
  await assert.rejects(app('clean'), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Rails app command "clean" failed: Forbidden/);
    assert.equal(error.message.includes(probeToken), false);
    return true;
  });
});

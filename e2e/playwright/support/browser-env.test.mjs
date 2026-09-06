import assert from 'node:assert/strict';
import test from 'node:test';

import { withoutRailsCapability } from './browser-env.mjs';

const probeToken = 'browser-env-probe-token';

test('keeps the Rails capability in Playwright but removes it from the browser environment', () => {
  const playwrightEnv = {
    E2E_RAILS_TOKEN: probeToken,
    PATH: '/e2e/bin:/usr/bin',
  };
  const browserEnv = withoutRailsCapability(playwrightEnv);

  assert.equal(playwrightEnv.E2E_RAILS_TOKEN, probeToken);
  assert.equal(browserEnv.PATH, playwrightEnv.PATH);
  assert.equal(browserEnv.E2E_RAILS_TOKEN, undefined);
});

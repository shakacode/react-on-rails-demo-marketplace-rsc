/**
 * Regression guard: RSC rendering errors must NOT leak message/stack in production.
 *
 * react-on-rails-pro >= 17.1.0 gates full error diagnostics on railsEnv,
 * emitting only `{ hasErrors: true }` outside development/test. This test reads
 * the installed injectRSCPayload.js and asserts the redaction logic is present,
 * catching silent regressions from a version downgrade or a publish that drops
 * the gate.
 *
 * Background: https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/237
 * Upstream fix: shakacode/react_on_rails#4736 -> #4821 -> #4856
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const INJECT_RSC_PAYLOAD_PATH = resolve(
  projectRoot,
  'node_modules/react-on-rails-pro/lib/injectRSCPayload.js',
);

let source;
try {
  source = readFileSync(INJECT_RSC_PAYLOAD_PATH, 'utf-8');
} catch (err) {
  throw new Error(
    `Cannot read injectRSCPayload.js — is react-on-rails-pro installed?\n${err.message}`,
  );
}

// ---------------------------------------------------------------------------
// 1. createRSCDiagnosticScript must accept a railsEnv parameter
//    (17.0.1 signature: metadata, cacheKey, sanitizedNonce — no railsEnv)
// ---------------------------------------------------------------------------
test('createRSCDiagnosticScript accepts a railsEnv parameter', () => {
  const fnSignature = source.match(
    /function\s+createRSCDiagnosticScript\s*\(([^)]*)\)/,
  );
  assert.ok(
    fnSignature,
    'createRSCDiagnosticScript function not found in injectRSCPayload.js',
  );

  const params = fnSignature[1];
  assert.ok(
    params.includes('railsEnv'),
    `createRSCDiagnosticScript must accept a railsEnv parameter for production redaction. ` +
      `Found signature: (${params}). ` +
      `This means react-on-rails-pro is pinned to a version that predates the fix ` +
      `(needs >= 17.1.0). See issue #237.`,
  );
});

// ---------------------------------------------------------------------------
// 2. The showFullDiagnostics gate must exist, restricting full details to
//    development or test — fail-closed for all other environments.
// ---------------------------------------------------------------------------
test('production error redaction gate (showFullDiagnostics) is present', () => {
  assert.ok(
    source.includes('showFullDiagnostics'),
    `injectRSCPayload.js must contain a showFullDiagnostics gate that restricts ` +
      `full error diagnostics to development/test. This guard is missing — the ` +
      `installed version likely predates the production redaction fix. ` +
      `See issue #237.`,
  );
});

// ---------------------------------------------------------------------------
// 3. The redaction must be fail-closed: only explicit development/test show
//    full diagnostics. Unknown, missing, or production railsEnv must redact.
// ---------------------------------------------------------------------------
test('redaction is fail-closed (only development/test show full diagnostics)', () => {
  const hasDevOrTestGate =
    /showFullDiagnostics\s*=\s*railsEnv\s*===\s*['"]development['"]/.test(source) &&
    /showFullDiagnostics\s*=[^;]*railsEnv\s*===\s*['"]test['"]/.test(source);

  assert.ok(
    hasDevOrTestGate,
    `The showFullDiagnostics flag must be set only when railsEnv is 'development' or 'test' ` +
      `(fail-closed allowlist). The expected pattern was not found in the installed source. ` +
      `See issue #237.`,
  );
});

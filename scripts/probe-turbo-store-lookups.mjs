// Run against a marketplace server. The fixture lives only in this disposable browser tab.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import webpack from 'webpack';

const baseUrl = process.argv[2] || 'http://localhost:3000';
const scratch = await mkdtemp(join(tmpdir(), 'marketplace-store-probe-'));
let browser;
try {
  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chromium' });
  const page = await browser.newPage();
  for (const path of ['/blog/ssr', '/product/ssr', '/product/rsc']) {
    const response = await page.goto(new URL(path, baseUrl).href);
    assert.equal(response.status(), 200, path);
    await page.waitForFunction(() => window.ReactOnRails?.option && document.querySelector('.js-react-on-rails-component'));
    const route = await page.evaluate(() => ({
      proVersion: JSON.parse(document.querySelector('#js-react-on-rails-context').textContent).rorProVersion,
      turbo: window.ReactOnRails.option('turbo'),
      islands: document.querySelectorAll('.js-react-on-rails-component').length,
      frames: document.querySelectorAll('turbo-frame').length,
      stores: document.querySelectorAll('[data-js-react-on-rails-store]').length,
      storeDependencies: [...document.querySelectorAll('.js-react-on-rails-component[data-store-dependencies]')]
        .flatMap((el) => JSON.parse(el.getAttribute('data-store-dependencies'))).length,
    }));
    console.log(JSON.stringify({ path, ...route }));
  }

  // Build the locked public Pro client entry for an isolated Turbo-enabled page.
  // A parser-blocking script sets the option before DOMContentLoaded and Pro lifecycle setup.
  const stats = await promisify(webpack)({
    mode: 'production',
    entry: 'react-on-rails-pro/client',
    output: { path: scratch, filename: 'pro.js', library: { type: 'window', name: 'ReactOnRails', export: 'default' } },
    optimization: { minimize: false },
    performance: { hints: false },
  });
  assert.ok(!stats.hasErrors(), stats.toString({ all: false, errors: true }));

  const fixture = await browser.newPage();
  const origin = 'http://store-probe.test';
  const names = ['catalog', 'account', 'currency', 'promo'];
  const ids = Array.from({ length: 16 }, (_, i) => `panel-${i}`);
  const tags = names.map((name) =>
    `<script type="application/json" data-js-react-on-rails-store="${name}">{}</script>`).join('');
  const panels = ids.map((id) => `<div id="${id}"></div>
    <script type="application/json" class="js-react-on-rails-component" data-dom-id="${id}"
      data-component-name="LookupProbe" data-store-dependencies='${JSON.stringify(names)}'>{}</script>
    <script>typeof ReactOnRails === 'object' && ReactOnRails.reactOnRailsComponentLoaded('${id}');</script>`).join('');
  // Playwright serves the fixture and its frame response on one origin. Turbo performs the request.
  await fixture.route(`${origin}/turbo.js`, (route) => route.fulfill({ path: fileURLToPath(import.meta.resolve('@hotwired/turbo')) }));
  await fixture.route(`${origin}/pro.js`, (route) => route.fulfill({ path: join(scratch, 'pro.js') }));
  await fixture.route(`${origin}/start`, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head>
      <script id="js-react-on-rails-context" type="application/json">{"rorPro":true}</script>
      <script src="/turbo.js"></script><script src="/pro.js"></script>
      <script>ReactOnRails.setOptions({turbo:true})</script></head><body>
      <turbo-frame id="probe"><a href="/next">Load panels</a></turbo-frame></body></html>`,
  }));
  await fixture.route(`${origin}/next`, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><body><turbo-frame id="probe">${panels}</turbo-frame></body></html>`,
  }));
  await fixture.goto(`${origin}/start`);
  await fixture.evaluate(({ names, tags }) => {
    const api = window.ReactOnRails;
    if (!api.option('turbo')) throw new Error('Turbo support was not enabled');
    for (const name of names) api.setStore(name, { getState: () => name });
    document.body.insertAdjacentHTML('beforeend', tags);
    const probe = { renders: 0, scans: 0, frameLoads: 0 };
    window.storeProbe = probe;
    api.register({
      LookupProbe(_props, _railsContext, id) {
        document.getElementById(id).textContent = names.map((name) => api.getStore(name).getState()).join(',');
        probe.renders++;
        return { teardown() {} };
      },
    });
    document.getElementById('probe').addEventListener('turbo:frame-load', () => { probe.frameLoads++; });
    const original = document.querySelectorAll;
    document.querySelectorAll = function (selector) {
      if (selector.includes('data-js-react-on-rails-store')) probe.scans++;
      return original.call(this, selector);
    };
    if (document.querySelectorAll('[data-js-react-on-rails-store]').length !== names.length || probe.scans !== 1) {
      throw new Error('Store scan instrumentation failed');
    }
    probe.scans = 0;
  }, { names, tags });

  const [response] = await Promise.all([
    fixture.waitForResponse(`${origin}/next`),
    fixture.getByRole('link', { name: 'Load panels' }).click(),
  ]);
  assert.equal(response.status(), 200);
  assert.equal(await response.request().headerValue('Turbo-Frame'), 'probe');
  await fixture.waitForFunction(() => window.storeProbe.frameLoads === 1 && document.querySelector('#probe[complete] #panel-15'));
  assert.equal(fixture.url(), `${origin}/start`);
  // Turbo activates the inline component-loaded callbacks that the Rails helper includes
  // after each declaration. Wait for their asynchronous Pro mounts as well as the frame load.
  await fixture.waitForFunction((size) => window.storeProbe.renders === size, ids.length);
  const scans = await fixture.evaluate(({ ids, names }) => {
    const expected = names.join(',');
    if (ids.some((id) => document.getElementById(id).textContent !== expected)) {
      throw new Error('A panel did not read all four stores');
    }
    return window.storeProbe.scans;
  }, { ids, names });
  console.log(JSON.stringify({
    chrome: browser.version(), turboFrameHeader: 'probe', verifiedMounts: ids.length,
    dependenciesPerIsland: names.length, navigationStoreSelectorCalls: scans,
  }));
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
}

// Run against a marketplace server. The fixture lives only in this disposable browser tab.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] || 'http://localhost:3000';
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chromium' });
try {
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

  // Exercise the demo's actual Pro client even on a page that declares no stores.
  const control = await page.evaluate(async () => {
    const api = window.ReactOnRails;
    const names = ['catalog', 'account', 'currency', 'promo'].map((name) => `probe-${name}`);
    for (const name of names) api.setStore(name, { getState: () => name });

    const frame = document.createElement('turbo-frame');
    for (const name of names) {
      const store = document.createElement('script');
      store.type = 'application/json';
      store.dataset.jsReactOnRailsStore = name;
      store.textContent = '{}';
      frame.append(store);
    }
    const ids = Array.from({ length: 16 }, (_, i) => `probe-panel-${i}`);
    for (const id of ids) {
      const root = document.createElement('div');
      root.id = id;
      const spec = document.createElement('script');
      spec.type = 'application/json';
      spec.className = 'js-react-on-rails-component';
      spec.dataset.domId = id;
      spec.dataset.componentName = 'LookupProbe';
      spec.dataset.storeDependencies = JSON.stringify(names);
      spec.textContent = '{}';
      frame.append(root, spec);
    }
    let renders = 0;
    api.register({
      LookupProbe(_props, _railsContext, id) {
        document.getElementById(id).textContent = names.map((name) => api.getStore(name).getState()).join(',');
        renders++;
        return { teardown() {} };
      },
    });
    document.body.append(frame);

    const original = document.querySelectorAll;
    let scans = 0;
    document.querySelectorAll = function (selector) {
      if (selector.includes('data-js-react-on-rails-store')) scans++;
      return original.call(this, selector);
    };
    try {
      // Positive control for the counter, with four actual store tags present.
      const observedTags = document.querySelectorAll('[data-js-react-on-rails-store]');
      const fixtureTags = [...observedTags].filter((el) => frame.contains(el)).length;
      if (scans !== 1 || fixtureTags !== names.length) throw new Error('Store scan instrumentation failed');
      scans = 0;
      frame.dispatchEvent(new Event('turbo:frame-render', { bubbles: true }));
      await new Promise(requestAnimationFrame);
      const afterFrameEvent = { renders, storeSelectorCalls: scans };

      scans = 0;
      await Promise.all(ids.map((id) => api.reactOnRailsComponentLoaded(id)));
      const expected = names.join(',');
      if (!ids.every((id) => document.getElementById(id).textContent === expected)) {
        throw new Error('A panel did not read the expected stores');
      }
      return { afterFrameEvent, renders, dependenciesPerIsland: names.length, explicitMountStoreScans: scans };
    } finally {
      document.querySelectorAll = original;
    }
  });
  assert.equal(control.renders, 16);
  console.log(JSON.stringify({ chrome: browser.version(), control }));
} finally {
  await browser.close();
}

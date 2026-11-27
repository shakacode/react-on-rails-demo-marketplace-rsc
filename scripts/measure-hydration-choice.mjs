import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { median } from './lib/stats.mjs';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000/product-search/ssr' },
    'verify-client': { type: 'boolean', default: false },
  },
});
const component = 'ProductSearchSSR';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });

async function measure() {
  // Keep the initial SSR tree and prevent subresource loads or app boot from affecting timing.
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route('**/*', route =>
    route.request().isNavigationRequest() ? route.continue() : route.abort(),
  );
  const response = await page.goto(values.url, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), 'Expected a successful product search SSR response');
  return page.evaluate((name) => {
    const script = document.querySelector(`script[data-component-name="${name}"]`);
    const root = script && document.getElementById(script.dataset.domId);
    if (!root?.firstElementChild) throw new Error('Expected prerendered ProductSearchSSR markup');
    const htmlCheck = element => Boolean(element.innerHTML);
    const elementCheck = element =>
      (element.localName !== 'template' && element.firstElementChild !== null) || htmlCheck(element);

    const controls = ['', ' ', 'text', '<!--boundary-->', '<span></span>'].map(markup => {
      const element = document.createElement('div');
      element.innerHTML = markup;
      return element;
    });
    const emptyText = document.createElement('div');
    emptyText.append(document.createTextNode(''));
    const template = document.createElement('template');
    // A template serializes its content fragment, even when it has an ordinary child.
    template.append(document.createElement('b'));
    if (![...controls, emptyText, template, root].every(el => htmlCheck(el) === elementCheck(el))) {
      throw new Error('Baseline and candidate hydration decisions differ');
    }
    const { products } = JSON.parse(script.textContent);
    if (!products?.length) throw new Error('Seed the marketplace with products before measuring');

    const repetitions = 192;
    function sample(predicate) {
      let rows = 0;
      const start = performance.now();
      for (let i = 0; i < repetitions; i++) {
        const props = JSON.parse(script.textContent);
        if (predicate(root)) rows += props.products.length;
      }
      const ms = (performance.now() - start) / repetitions;
      if (rows !== repetitions * products.length) throw new Error('Unexpected render input');
      return ms;
    }
    const samples = [];
    for (let trial = 0; trial < 3; trial++) {
      sample(htmlCheck);
      sample(elementCheck);
      for (let i = 0; i < 10; i++) {
        let baseline;
        let candidate;
        if ((trial + i) % 2 === 0) {
          baseline = sample(htmlCheck);
          candidate = sample(elementCheck);
        } else {
          candidate = sample(elementCheck);
          baseline = sample(htmlCheck);
        }
        samples.push({ baseline, candidate });
      }
    }
    return {
      products: products.length,
      htmlBytes: new TextEncoder().encode(root.innerHTML).length,
      propsBytes: new TextEncoder().encode(script.textContent).length,
      repetitions,
      samples,
    };
  }, component);
}

async function verifyClient() {
  const page = await browser.newPage();
  // Instrument only this browser context. The native getter still returns its original value.
  await page.addInitScript((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const observations = { reads: 0, firstChild: null };
    window.__hydrationProbe = observations;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...descriptor,
      get() {
        const html = descriptor.get.call(this);
        const metadata = this.id && document.getElementById(`js-react-on-rails-component-${this.id}`);
        if (metadata && metadata.dataset.componentName === name) {
          observations.reads++;
          observations.firstChild ??= this.firstElementChild;
        }
        return html;
      },
    });
  }, component);
  await page.goto(values.url, { waitUntil: 'domcontentloaded' });
  const script = page.locator(`script[data-component-name="${component}"]`);
  const rootId = await script.getAttribute('data-dom-id');
  assert(rootId, 'ProductSearchSSR root ID missing');
  const root = page.locator(`[id="${rootId}"]`);
  // This button only changes local React state. Its state change confirms interactivity.
  await page.waitForFunction(() => window.__hydrationProbe.reads > 0);
  await root.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  await root.getByRole('button', { name: 'Added!', exact: true }).first().waitFor();
  const proof = await root.evaluate(el => ({
    reads: window.__hydrationProbe.reads,
    keptServerChild: el.firstElementChild === window.__hydrationProbe.firstChild,
  }));
  assert(proof.keptServerChild, 'Hydration replaced the server-rendered first element');
  return proof;
}

try {
  const result = await measure();
  if (values['verify-client']) result.currentClient = await verifyClient();
  console.log(JSON.stringify({
    url: values.url,
    browser: browser.version(),
    medianMs: Object.fromEntries(['baseline', 'candidate'].map(
      key => [key, median(result.samples.map(pair => pair[key]))],
    )),
    ...result,
  }, null, 2));
} finally {
  await browser.close();
}

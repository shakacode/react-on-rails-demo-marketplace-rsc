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
function predicates() {
  return {
    baseline: el => Boolean(el.innerHTML),
    candidate: el => (el.localName !== 'template' && el.firstElementChild !== null) || Boolean(el.innerHTML),
  };
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });

async function measure() {
  // Keep the initial SSR tree and prevent subresource loads or app boot from affecting timing.
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route('**/*', route =>
    route.request().isNavigationRequest() ? route.continue() : route.abort(),
  );
  const response = await page.goto(values.url, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), 'Expected a successful product search SSR response');
  const checks = await page.evaluateHandle(predicates);
  return page.evaluate(({ name, checks: { baseline: htmlCheck, candidate: elementCheck } }) => {
    const script = document.querySelector(`script[data-component-name="${name}"]`);
    const root = script && document.getElementById(script.dataset.domId);
    if (!root?.firstElementChild) throw new Error('Expected prerendered ProductSearchSSR markup');
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
  }, { name: component, checks });
}

// Only rewrite the boolean lookup at the getter's exact Chromium call site.
// If the deployed bundle changes shape, abort the experiment.
function instrumentLookup(source, lookup) {
  const lines = source.split('\n');
  const line = lines[lookup.line - 1];
  const before = line.slice(0, lookup.column - 1);
  const after = line.slice(lookup.column - 1);
  const match = before.match(/&&\s*!!([a-zA-Z_$][\w$]*)\.$/);
  assert(match && /^innerHTML\b/.test(after), 'Observed read was not the supported hydration check');
  const variable = match[1];
  const from = before.lastIndexOf('!!');
  const replacement = `window.__hydrationProbe.choose(${variable}, ${predicates().candidate})`;
  lines[lookup.line - 1] = before.slice(0, from) + replacement + after.slice('innerHTML'.length);
  return lines.join('\n');
}

async function verifyClient(lookup, forceClientRender = false) {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  if (lookup) {
    await page.route(lookup.url, async route => {
      const original = await route.fetch();
      await route.fulfill({ response: original, body: instrumentLookup(await original.text(), lookup) });
    });
  }
  // Instrument only this browser context. The native getter still returns its original value.
  await page.addInitScript(({ name, forceClientRender }) => {
    const isTarget = el => el.id &&
      document.getElementById(`js-react-on-rails-component-${el.id}`)?.dataset.componentName === name;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const observations = {
      reads: [], firstChild: null, candidateCalls: 0,
      choose(el, predicate) {
        if (!isTarget(el)) return Boolean(el.innerHTML);
        this.candidateCalls++;
        this.firstChild = el.firstElementChild;
        return forceClientRender ? false : predicate(el);
      },
    };
    window.__hydrationProbe = observations;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...descriptor,
      get() {
        const html = descriptor.get.call(this);
        if (isTarget(this)) {
          observations.reads.push(new Error().stack.split('\n')[2]);
          observations.firstChild ??= this.firstElementChild;
        }
        return html;
      },
    });
  }, { name: component, forceClientRender });
  await page.goto(values.url, { waitUntil: 'domcontentloaded' });
  const script = page.locator(`script[data-component-name="${component}"]`);
  const rootId = await script.getAttribute('data-dom-id');
  assert(rootId, 'ProductSearchSSR root ID missing');
  const root = page.locator(`[id="${rootId}"]`);
  // This button only changes local React state. Its state change confirms interactivity.
  await page.waitForFunction(() => window.__hydrationProbe.reads.length || window.__hydrationProbe.candidateCalls);
  await root.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  await root.getByRole('button', { name: 'Added!', exact: true }).first().waitFor();
  const proof = await root.evaluate(el => ({
    reads: window.__hydrationProbe.reads,
    candidateCalls: window.__hydrationProbe.candidateCalls,
    keptServerChild: el.firstElementChild === window.__hydrationProbe.firstChild,
  }));
  assert.equal(proof.keptServerChild, !forceClientRender,
    'Only the forced client render should replace the server-rendered first element');
  await page.close();
  if (lookup) {
    assert.equal(proof.candidateCalls, 1, 'Candidate lookup did not run on the live render path');
    assert.equal(proof.reads.length, 0, 'Candidate still serialized root HTML');
  } else {
    assert.equal(proof.reads.length, 1, 'Expected exactly one baseline root read to attribute');
  }
  return proof;
}

async function verifyBothClients() {
  const baseline = await verifyClient();
  const frame = baseline.reads[0].match(/(https?:\/\/[^\s()]+):(\d+):(\d+)\)?$/);
  assert(frame, 'Could not locate the baseline root read in a served script');
  const lookup = { url: frame[1], line: Number(frame[2]), column: Number(frame[3]) };
  const candidate = await verifyClient(lookup);
  // Prove the observed boolean controls React's choice: forcing false must replace the SSR child.
  const clientRenderControl = await verifyClient(lookup, true);
  return { baseline, candidate, clientRenderControl, lookup };
}

try {
  const result = await measure();
  if (values['verify-client']) result.integration = await verifyBothClients();
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

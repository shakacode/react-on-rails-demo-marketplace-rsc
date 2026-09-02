#!/usr/bin/env node

// End-to-end test for bidirectional (pull-mode) async props with unstable_cache.
//
// Verifies that /product/rsc-pull:
// 1. SSR renders correctly with all expected sections
// 2. Hydrates without errors (no console errors, no hydration mismatches)
// 3. Interactive client components work (image gallery, quantity selector)
// 4. On cache HIT, the page still renders correctly
// 5. No duplicate <script> tags, no error panels
//
// Requires: Rails server + Node renderer running (with RSC_CACHE_ENABLED=true).
// Usage:   BASE_URL=http://localhost:3100 node scripts/verify-pull-mode-e2e.js
//   or:    pnpm test:pull-mode

const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const ROUTE = '/product/rsc-pull';
const TIMEOUT = 25000;

// React minified-error codes that mean a hydration mismatch
const HYDRATION_ERROR_CODES = new Set(['418', '419', '420', '421', '422', '423', '425']);

function isHydrationError(text) {
  if (!text) return false;
  const m = text.match(/Minified React error #(\d+)/);
  if (m && HYDRATION_ERROR_CODES.has(m[1])) return true;
  if (/Hydration failed/i.test(text)) return true;
  if (/Text content does not match/i.test(text)) return true;
  return false;
}

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      process.stderr.write(`  ✓ ${message}\n`);
    } else {
      this.failed++;
      this.errors.push(message);
      process.stderr.write(`  ✗ ${message}\n`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
  }

  assertIncludes(text, substring, message) {
    this.assert(
      typeof text === 'string' && text.includes(substring),
      `${message} (looking for ${JSON.stringify(substring)})`,
    );
  }

  summary() {
    process.stderr.write(`\n========== PULL-MODE E2E RESULTS ==========\n`);
    process.stderr.write(`Passed: ${this.passed}, Failed: ${this.failed}\n`);
    if (this.errors.length > 0) {
      process.stderr.write(`\nFailures:\n`);
      for (const e of this.errors) {
        process.stderr.write(`  ✗ ${e}\n`);
      }
    }
    return this.failed === 0;
  }
}

async function collectPageState(page) {
  return page.evaluate(() => {
    const body = document.body;
    const text = body?.innerText || '';
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
    const dupes = scripts.filter((s, i, a) => a.indexOf(s) !== i);

    return {
      bodyText: text,
      bodyTextLength: text.length,
      hasErrorPanel: !!document.getElementById('error-diagnostic'),
      duplicateScripts: dupes,
      title: document.title,
      // Check for key content sections
      hasV5Banner: text.includes('V5: RSC Pull-Mode'),
      hasProductName: text.includes('ProSound Elite X1'),
      hasProductDescription: text.includes('Product Description'),
      hasReviewStats: text.includes('Customer Reviews'),
      hasRelatedProducts: text.includes('Customers Also Viewed'),
      hasSpecSheet: text.includes('Pricing — global ladder'),
      hasAddToCart: text.includes('Add to Cart'),
      hasBreadcrumb: text.includes('Headphones'),
      // Interactive element states
      quantity: (() => {
        // Find the quantity display between Decrease/Increase buttons
        const btns = Array.from(document.querySelectorAll('button'));
        const increaseBtn = btns.find(b => b.getAttribute('aria-label') === 'Increase quantity'
          || b.textContent?.trim() === '+');
        if (!increaseBtn) return null;
        const container = increaseBtn.parentElement;
        if (!container) return null;
        // The quantity is in a span/div between the two buttons
        const spans = container.querySelectorAll('span, div');
        for (const s of spans) {
          const num = parseInt(s.textContent?.trim(), 10);
          if (!isNaN(num) && num > 0) return num;
        }
        return null;
      })(),
      cartButtonText: (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const cart = btns.find(b => b.textContent?.includes('Add to Cart'));
        return cart?.textContent?.trim() || null;
      })(),
    };
  });
}

(async () => {
  const t = new TestRunner();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ===================================================================
  // TEST 1: First load (cache cold) — full SSR + hydration
  // ===================================================================
  process.stderr.write(`\n--- Test 1: First load (SSR + hydration) ---\n`);
  {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const resp = await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    // Let React finish any post-paint work
    await new Promise(r => setTimeout(r, 1000));

    t.assertEqual(resp.status(), 200, 'HTTP status is 200');
    t.assert(pageErrors.length === 0, `No page errors (got ${pageErrors.length}: ${pageErrors.join('; ')})`);

    const hydrationErrors = consoleErrors.filter(isHydrationError);
    t.assert(hydrationErrors.length === 0, `No hydration errors (got ${hydrationErrors.length}: ${hydrationErrors.join('; ')})`);

    const state = await collectPageState(page);

    t.assert(!state.hasErrorPanel, 'No error diagnostic panel');
    t.assert(state.duplicateScripts.length === 0, `No duplicate scripts (got ${state.duplicateScripts.length})`);
    t.assert(state.bodyTextLength > 500, `Body has substantial content (${state.bodyTextLength} chars)`);

    // Content sections
    t.assert(state.hasV5Banner, 'V5 Pull-Mode banner is visible');
    t.assert(state.hasProductName, 'Product name (ProSound Elite X1) is rendered');
    t.assert(state.hasProductDescription, 'Product Description section is rendered');
    t.assert(state.hasReviewStats, 'Customer Reviews section is rendered');
    t.assert(state.hasRelatedProducts, 'Related products (Customers Also Viewed) are rendered');
    t.assert(state.hasSpecSheet, 'Spec sheet (Pricing — global ladder) is rendered');
    t.assert(state.hasAddToCart, 'Add to Cart button is present');
    t.assert(state.hasBreadcrumb, 'Breadcrumb (Headphones) is present');

    await page.close();
  }

  // ===================================================================
  // TEST 2: Second load (cache warm) — still renders correctly
  // ===================================================================
  process.stderr.write(`\n--- Test 2: Second load (cache warm) ---\n`);
  {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const resp = await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(r => setTimeout(r, 1000));

    t.assertEqual(resp.status(), 200, 'Cache-warm HTTP status is 200');
    t.assert(pageErrors.length === 0, `No page errors on cache-warm load (got ${pageErrors.length})`);

    const hydrationErrors = consoleErrors.filter(isHydrationError);
    t.assert(hydrationErrors.length === 0, `No hydration errors on cache-warm load (got ${hydrationErrors.length})`);

    const state = await collectPageState(page);
    t.assert(state.hasV5Banner, 'Cache-warm: V5 banner visible');
    t.assert(state.hasProductDescription, 'Cache-warm: Product Description rendered');
    t.assert(state.hasReviewStats, 'Cache-warm: Customer Reviews rendered');
    t.assert(state.hasRelatedProducts, 'Cache-warm: Related products rendered');
    t.assert(state.hasSpecSheet, 'Cache-warm: Spec sheet rendered');

    await page.close();
  }

  // ===================================================================
  // TEST 3: Hydration — interactive client components work
  // ===================================================================
  process.stderr.write(`\n--- Test 3: Client component hydration ---\n`);
  {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(r => setTimeout(r, 1000));

    // Test quantity selector
    const initialState = await collectPageState(page);
    t.assertEqual(initialState.quantity, 1, 'Initial quantity is 1');
    t.assertIncludes(initialState.cartButtonText, '$299.99', 'Initial cart button shows $299.99');

    // Click increase quantity
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.getAttribute('aria-label') === 'Increase quantity'
        || b.textContent?.trim() === '+');
      if (btn) { btn.click(); return true; }
      return false;
    });
    t.assert(clicked, 'Found and clicked increase quantity button');

    await new Promise(r => setTimeout(r, 300));
    const afterIncrease = await collectPageState(page);
    t.assertEqual(afterIncrease.quantity, 2, 'Quantity updated to 2 after click');
    t.assertIncludes(afterIncrease.cartButtonText, '$599.98', 'Cart button updated to $599.98');

    // Test image gallery — click second thumbnail
    const imageChanged = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('button img'));
      if (images.length < 2) return false;
      const secondThumb = images[1].closest('button');
      if (!secondThumb) return false;
      secondThumb.click();
      return true;
    });
    t.assert(imageChanged, 'Clicked second image thumbnail');

    await new Promise(r => setTimeout(r, 300));
    const imageState = await page.evaluate(() => {
      // Check if the main image alt text changed or if "2 / 5" is visible
      const text = document.body?.innerText || '';
      return text.includes('2 / 5') || text.includes('2/5');
    });
    t.assert(imageState, 'Image gallery shows 2 / 5 after clicking second thumbnail');

    t.assert(pageErrors.length === 0, `No page errors during interaction (got ${pageErrors.length})`);

    await page.close();
  }

  // ===================================================================
  // TEST 4: Multiple loads — page renders consistently
  // ===================================================================
  process.stderr.write(`\n--- Test 4: Consistency across multiple loads ---\n`);
  {
    let allOk = true;
    for (let i = 0; i < 3; i++) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const resp = await page.goto(BASE + ROUTE, { waitUntil: 'networkidle0', timeout: TIMEOUT });
      await new Promise(r => setTimeout(r, 500));

      const state = await collectPageState(page);
      if (resp.status() !== 200 || pageErrors.length > 0 || !state.hasProductDescription || !state.hasReviewStats) {
        allOk = false;
      }
      await page.close();
    }
    t.assert(allOk, 'Page renders correctly across 3 consecutive loads');
  }

  // ===================================================================
  // TEST 5: Push-mode regression — /product/rsc still works
  // ===================================================================
  process.stderr.write(`\n--- Test 5: Push-mode regression (/product/rsc) ---\n`);
  {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const resp = await page.goto(BASE + '/product/rsc', { waitUntil: 'networkidle0', timeout: TIMEOUT });
    await new Promise(r => setTimeout(r, 500));

    t.assertEqual(resp.status(), 200, 'Push-mode HTTP status is 200');
    t.assert(pageErrors.length === 0, `Push-mode: no page errors (got ${pageErrors.length})`);

    const state = await collectPageState(page);
    t.assert(state.hasProductDescription, 'Push-mode: Product Description rendered');
    t.assert(state.hasReviewStats, 'Push-mode: Customer Reviews rendered');
    t.assert(state.hasRelatedProducts, 'Push-mode: Related products rendered');

    await page.close();
  }

  await browser.close();

  const ok = t.summary();
  process.exit(ok ? 0 : 1);
})();

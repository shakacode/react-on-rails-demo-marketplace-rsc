// Comprehensive page verifier:
// - opens each route
// - waits for network idle (hydration window)
// - captures all console messages, page errors, request failures
// - reports anything that's not a clean load

const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const ROUTES = [
  '/',
  '/why-rsc',
  '/measure',
  '/search-performance',
  '/rsc',
  '/search/ssr', '/search/client', '/search/rsc',
  '/product/ssr', '/product/client', '/product/rsc',
  '/product-search/ssr', '/product-search/client', '/product-search/rsc',
  '/blog/ssr', '/blog/client', '/blog/rsc', '/blog/rsc-simple',
  '/blog/rsc-step1', '/blog/rsc-step1b', '/blog/rsc-step1c',
  '/blog/rsc-step2', '/blog/rsc-step3', '/blog/rsc-step4', '/blog/rsc-step5',
  '/analytics/ssr', '/analytics/client', '/analytics/rsc',
];

// React minified-error codes that mean a hydration mismatch
const HYDRATION_ERROR_CODES = new Set(['418', '419', '420', '421', '422', '423', '425']);

function classify(text) {
  if (!text) return null;
  if (/ReactOnRails was already initialized/i.test(text)) return 'ror-init';
  if (/Cannot access ['"][^'"]+['"] before initialization/i.test(text)) return 'tdz';
  const m = text.match(/Minified React error #(\d+)/);
  if (m && HYDRATION_ERROR_CODES.has(m[1])) return `hydration-#${m[1]}`;
  if (m) return `react-#${m[1]}`;
  if (/Hydration failed/i.test(text)) return 'hydration-failed';
  if (/Text content does not match/i.test(text)) return 'hydration-text-mismatch';
  return 'other';
}

async function checkRoute(browser, route) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Skip known-noisy network 404s for missing static assets we don't control
      if (text.includes('Failed to load resource') && !/\/packs\//.test(text)) return;
      consoleErrors.push({ type: msg.type(), text, kind: classify(text) });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack, kind: classify(err.message) });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    // Ignore third-party image preloads from picsum that sometimes 404
    if (url.startsWith(BASE)) {
      failedRequests.push({ url: url.replace(BASE, ''), reason: req.failure()?.errorText });
    }
  });

  let httpStatus = null;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 25000 });
    httpStatus = resp ? resp.status() : null;
  } catch (e) {
    return {
      route, httpStatus, ok: false, navError: e.message,
      consoleErrors, pageErrors, failedRequests,
    };
  }

  // Give React a beat to finish any post-paint work
  await new Promise(r => setTimeout(r, 800));

  // Check that something rendered
  const bodyTextLength = await page.evaluate(() => document.body?.innerText?.length || 0);
  const hasErrorPanel = await page.evaluate(() => !!document.getElementById('error-diagnostic'));

  // Detect duplicate <script src=...>
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'))
  );
  const dupes = scripts.filter((s, i, a) => a.indexOf(s) !== i);

  await page.close();

  const ok = httpStatus === 200
    && pageErrors.length === 0
    && consoleErrors.filter(e => e.kind !== 'other').length === 0
    && !hasErrorPanel
    && dupes.length === 0
    && bodyTextLength > 100;

  return {
    route, httpStatus, ok,
    bodyTextLength, hasErrorPanel,
    duplicateScripts: dupes,
    consoleErrors, pageErrors, failedRequests,
  };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  for (const route of ROUTES) {
    process.stderr.write(`checking ${route} ... `);
    const r = await checkRoute(browser, route);
    process.stderr.write(r.ok ? 'OK\n' : `FAIL (status=${r.httpStatus} pageErrors=${r.pageErrors.length} consoleErrs=${r.consoleErrors.filter(e=>e.kind!=='other').length} dupes=${r.duplicateScripts.length})\n`);
    results.push(r);
  }

  await browser.close();

  // Summary
  console.log('\n========== SUMMARY ==========');
  const fail = results.filter(r => !r.ok);
  console.log(`Total: ${results.length}, OK: ${results.length - fail.length}, FAIL: ${fail.length}\n`);

  for (const r of fail) {
    console.log(`\n--- FAIL ${r.route} ---`);
    console.log(`  status=${r.httpStatus} bodyLen=${r.bodyTextLength} dupes=${r.duplicateScripts.length} errorPanel=${r.hasErrorPanel}`);
    if (r.navError) console.log(`  navError: ${r.navError}`);
    for (const e of r.pageErrors) {
      console.log(`  pageError [${e.kind || 'unclassified'}]: ${e.message.split('\n')[0]}`);
    }
    for (const e of r.consoleErrors.filter(x => x.kind !== 'other')) {
      console.log(`  console.${e.type} [${e.kind}]: ${e.text.split('\n')[0].slice(0, 200)}`);
    }
    for (const f of r.failedRequests) {
      console.log(`  failed-request: ${f.url} (${f.reason})`);
    }
    if (r.duplicateScripts.length) {
      console.log(`  duplicates: ${[...new Set(r.duplicateScripts)].join(', ')}`);
    }
  }

  process.exit(fail.length === 0 ? 0 : 1);
})();

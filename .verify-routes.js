// Comprehensive page verifier:
// - opens each route
// - waits for network idle (hydration window)
// - submits a client-side product search and verifies the resulting empty state
// - captures all console messages, page errors, request failures
// - reports anything that's not a clean load

const puppeteer = require('puppeteer');
const publicRouteContract = require('./config/public_routes.json');

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const BROWSER_PARAMETER_VALUES = { restaurant: '1' };
const PERSISTENT_MEDIA_ROUTES = new Set(['/media-gallery', '/media-gallery/rsc']);
const MEDIA_LIGHTBOX_THUMBNAIL_SELECTOR =
  'button[aria-label="Open image 1 of 8 in the react-image-lightbox lightbox"]';
const MEDIA_LIGHTBOX_CLOSE_SELECTOR = 'button[aria-label="Close lightbox"]';

function browserRouteFor(routeCase) {
  const route = Object.entries(routeCase.parameters || {}).reduce(
    (path, [parameter, fixtureName]) => {
      const parameterValue = BROWSER_PARAMETER_VALUES[fixtureName];
      if (parameterValue === undefined) {
        throw new Error(
          `No deterministic browser value for ${fixtureName} (${routeCase.path} :${parameter})`
        );
      }

      return path.replace(`:${parameter}`, encodeURIComponent(parameterValue));
    },
    routeCase.request_path || routeCase.path
  );

  if (/:[A-Za-z_][A-Za-z0-9_]*/.test(route)) {
    throw new Error(`Unresolved browser route parameter in ${route}`);
  }

  return route;
}

const DEFAULT_ROUTES = publicRouteContract.routes.flatMap((routeCase) => {
  if (routeCase.expected_status === 200) return [browserRouteFor(routeCase)];
  if (routeCase.expected_location) return [];

  throw new Error(
    `Public route ${routeCase.path} is neither browser-rendered nor an explicit redirect`
  );
});

if (process.argv.includes('--list-routes')) {
  console.log(JSON.stringify(DEFAULT_ROUTES));
  process.exit(0);
}

// A harness can scope the run to a subset (e.g. just the RSC client-boundary
// routes) via a comma-separated ROUTES env var; default is the canonical list.
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',').map((r) => r.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

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

async function checkProductSearchInteraction(page) {
  const inputSelector = 'input[placeholder="Search products, brands, categories..."]';
  const query = 'chromium-smoke-no-match-zqxj-74019';
  const isSearchApiResponse = (response, pathname) => {
    const url = new URL(response.url());
    return url.origin === new URL(BASE).origin
      && url.pathname === pathname
      && url.searchParams.get('q') === query;
  };

  await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 });
  await page.focus(inputSelector);
  const inputIsFocused = await page.evaluate(
    (selector) => document.activeElement === document.querySelector(selector),
    inputSelector
  );
  if (!inputIsFocused) {
    throw new Error('search input did not receive focus');
  }

  // The explicit API waits below are the readiness gate for the updated
  // search page; waiting for all network activity to stop is broader than the
  // interaction contract and can remain unsettled in current Chromium.
  const [response, resultsResponse, facetsResponse] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }),
    page.waitForResponse(
      (candidate) => isSearchApiResponse(candidate, '/api/product_search/results'),
      { timeout: 25000 }
    ),
    page.waitForResponse(
      (candidate) => isSearchApiResponse(candidate, '/api/product_search/facets'),
      { timeout: 25000 }
    ),
    (async () => {
      await page.evaluate(({ selector, value }) => {
        const input = document.querySelector(selector);
        if (!(input instanceof HTMLInputElement)) {
          throw new Error('search input was not available');
        }

        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!valueSetter) {
          throw new Error('search input value setter was not available');
        }

        valueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, { selector: inputSelector, value: query });
      await page.keyboard.press('Enter');
    })(),
  ]);

  if (!response || response.status() !== 200) {
    throw new Error(`search navigation returned status ${response ? response.status() : 'unknown'}`);
  }
  if (!resultsResponse.ok()) {
    throw new Error(`search results API returned status ${resultsResponse.status()}`);
  }
  if (!facetsResponse.ok()) {
    throw new Error(`search facets API returned status ${facetsResponse.status()}`);
  }

  let resultsPayload;
  let facetsPayload;
  try {
    [resultsPayload, facetsPayload] = await Promise.all([
      resultsResponse.json(),
      facetsResponse.json(),
    ]);
  } catch (e) {
    throw new Error(`search API response was not valid JSON: ${e.message}`);
  }

  const hasExpectedResults = Array.isArray(resultsPayload?.products)
    && resultsPayload.products.length === 0
    && resultsPayload?.meta?.query === query
    && resultsPayload.meta.total_results === 0;
  if (!hasExpectedResults) {
    throw new Error('search results API did not return the expected no-match payload');
  }

  const facets = facetsPayload?.facets;
  const hasExpectedFacets = facets !== null
    && typeof facets === 'object'
    && !Array.isArray(facets)
    && facets.total_count === 0;
  if (!hasExpectedFacets) {
    throw new Error('search facets API did not return the expected no-match payload');
  }

  await page.waitForFunction(
    ({ selector, expectedQuery }) => {
      const input = document.querySelector(selector);
      const url = new URL(window.location.href);
      const hasEmptyState = Array.from(document.querySelectorAll('h3'))
        .some((heading) => heading.textContent?.trim() === 'No products found');

      return url.searchParams.get('q') === expectedQuery
        && input instanceof HTMLInputElement
        && input.value === expectedQuery
        && hasEmptyState;
    },
    { timeout: 5000 },
    { selector: inputSelector, expectedQuery: query }
  );

  const state = await page.evaluate((selector) => {
    const input = document.querySelector(selector);
    const url = new URL(window.location.href);
    const hasEmptyState = Array.from(document.querySelectorAll('h3'))
      .some((heading) => heading.textContent?.trim() === 'No products found');

    return {
      query: url.searchParams.get('q'),
      inputValue: input instanceof HTMLInputElement ? input.value : null,
      hasEmptyState,
    };
  }, inputSelector);

  if (state.query !== query) {
    throw new Error(`search URL query was ${JSON.stringify(state.query)}, expected ${JSON.stringify(query)}`);
  }
  if (state.inputValue !== query) {
    throw new Error(`search input value was ${JSON.stringify(state.inputValue)}, expected ${JSON.stringify(query)}`);
  }
  if (!state.hasEmptyState) {
    throw new Error('search results did not render the expected empty state');
  }
}

async function checkMediaClientInteraction(page) {
  // The thumbnail is present in the server HTML, but opening and closing the
  // lightbox requires its client-island event handlers to have hydrated.
  const timeout = 25000;
  const deadline = Date.now() + timeout;
  const selectors = {
    thumbnailSelector: MEDIA_LIGHTBOX_THUMBNAIL_SELECTOR,
    closeSelector: MEDIA_LIGHTBOX_CLOSE_SELECTOR,
  };
  const timedOut = () => new Error(`Media lightbox did not open and close within ${timeout}ms`);
  const evaluateBeforeDeadline = async (pageFunction) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw timedOut();

    let timer;
    try {
      return await Promise.race([
        page.evaluate(pageFunction, selectors),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(timedOut()), remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

  let opened = false;
  while (!opened) {
    opened = await evaluateBeforeDeadline(({ thumbnailSelector, closeSelector }) => {
      if (document.querySelector(closeSelector)) return true;

      const thumbnail = document.querySelector(thumbnailSelector);
      if (typeof thumbnail?.click === 'function') thumbnail.click();
      return false;
    });
    if (!opened) await yieldToBrowser();
  }

  let closed = false;
  while (!closed) {
    closed = await evaluateBeforeDeadline(({ closeSelector }) => {
      const close = document.querySelector(closeSelector);
      if (!close) return true;

      if (typeof close.click === 'function') close.click();
      return false;
    });
    if (!closed) await yieldToBrowser();
  }
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
  let interactionError = null;
  try {
    // These two media pages keep requests active and media elements loading,
    // so neither networkidle0 nor load completes. They still run every
    // post-paint, HTTP, page/console error, and duplicate-script check. The
    // pre-existing route set retains the stricter networkidle0 condition.
    const waitUntil = PERSISTENT_MEDIA_ROUTES.has(route) ? 'domcontentloaded' : 'networkidle0';
    const resp = await page.goto(BASE + route, { waitUntil, timeout: 25000 });
    httpStatus = resp ? resp.status() : null;
  } catch (e) {
    await page.close().catch(() => {});
    return {
      route, httpStatus, ok: false, navError: e.message,
      bodyTextLength: 0, hasErrorPanel: false,
      duplicateScripts: [],
      consoleErrors, pageErrors, failedRequests,
    };
  }

  if (PERSISTENT_MEDIA_ROUTES.has(route)) {
    try {
      await checkMediaClientInteraction(page);
    } catch (e) {
      interactionError = e.message;
    }
  }

  // Give React a beat to finish any post-paint work
  await new Promise(r => setTimeout(r, 800));

  if (route === '/product-search/client') {
    try {
      await checkProductSearchInteraction(page);
    } catch (e) {
      interactionError = e.message;
    }
  }

  if (interactionError) {
    await page.close().catch(() => {});
    return {
      route, httpStatus, ok: false,
      interactionError,
      bodyTextLength: 0, hasErrorPanel: false,
      duplicateScripts: [],
      consoleErrors, pageErrors, failedRequests,
    };
  }

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
    && bodyTextLength > 100
    && interactionError === null;

  return {
    route, httpStatus, ok,
    interactionError,
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
  try {
    for (const route of ROUTES) {
      process.stderr.write(`checking ${route} ... `);
      const r = await checkRoute(browser, route);
      process.stderr.write(r.ok ? 'OK\n' : `FAIL (status=${r.httpStatus} pageErrors=${r.pageErrors.length} consoleErrs=${r.consoleErrors.filter(e=>e.kind!=='other').length} dupes=${r.duplicateScripts.length})\n`);
      results.push(r);
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n========== SUMMARY ==========');
  const fail = results.filter(r => !r.ok);
  console.log(`Total: ${results.length}, OK: ${results.length - fail.length}, FAIL: ${fail.length}\n`);

  for (const r of fail) {
    console.log(`\n--- FAIL ${r.route} ---`);
    console.log(`  status=${r.httpStatus} bodyLen=${r.bodyTextLength} dupes=${r.duplicateScripts.length} errorPanel=${r.hasErrorPanel}`);
    if (r.navError) console.log(`  navError: ${r.navError}`);
    if (r.interactionError) console.log(`  interactionError: ${r.interactionError}`);
    for (const e of r.pageErrors) {
      console.log(`  pageError [${e.kind || 'unclassified'}]: ${e.message.split('\n')[0]}`);
    }
    for (const e of r.consoleErrors.filter(x => x.kind !== 'other')) {
      console.log(`  console.${e.type} [${e.kind}]: ${e.text.split('\n')[0].slice(0, 200)}`);
    }
    for (const f of r.failedRequests) {
      console.log(`  failed-request: ${f.url} (${f.reason})`);
    }
    if (r.duplicateScripts.length > 0) {
      console.log(`  duplicates: ${[...new Set(r.duplicateScripts)].join(', ')}`);
    }
  }

  process.exit(fail.length === 0 ? 0 : 1);
})();

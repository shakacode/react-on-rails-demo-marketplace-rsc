// Comprehensive page verifier:
// - opens each route
// - waits for a per-route readiness signal (see PERSISTENT_MEDIA_ROUTES)
// - submits a client-side product search and verifies the resulting empty state
// - drives all four media-gallery client islands to prove they hydrated and
//   that their deferred chunks resolve
// - captures all console messages, page errors, request failures
// - reports anything that's not a clean load

const BASE = process.env.BASE_URL || 'http://localhost:3010';
// Keep in sync with RouteContract in spec/support/route_contract.rb — every
// rendered page and renderer-backed route, with the id-scoped routes resolved to
// the seeded id 1. spec/routing/browser_route_parity_spec.rb fails if this list
// and the contract disagree in either direction, so a new page cannot be added
// without either browser coverage or a documented reason.
const DEFAULT_ROUTES = [
  // Marketing / content pages
  '/',
  '/how-rsc-works',
  '/measure',
  '/rsc-performance',
  '/ssr-rsc-playground',
  '/why-rsc',
  // RSC entry points
  '/products',
  '/rsc',
  // Media gallery — both paths hit the same RSC action
  '/media-gallery', '/media-gallery/rsc',
  // Restaurant detail
  '/restaurant/1/ssr', '/restaurant/1/ssr-cached', '/restaurant/1/client',
  '/restaurant/1/rsc', '/restaurant/1/rsc-cached',
  // Virtualized review-list siblings (issue #184)
  '/restaurant/1/ssr-virtual', '/restaurant/1/rsc-virtual',
  // Product detail
  '/product/ssr', '/product/ssr-cached', '/product/client',
  '/product/rsc', '/product/rsc-cached', '/product/rsc-pull',
  // Product search
  '/product-search/ssr', '/product-search/ssr-cached', '/product-search/client',
  '/product-search/rsc', '/product-search/rsc-cached',
  // Blog
  '/blog/ssr', '/blog/ssr-cached', '/blog/client',
  '/blog/rsc', '/blog/rsc-cached', '/blog/rsc-simple', '/blog/rsc-simple-cached',
  '/blog/rsc-step1', '/blog/rsc-step1b', '/blog/rsc-step1c',
  '/blog/rsc-step2', '/blog/rsc-step3', '/blog/rsc-step4', '/blog/rsc-step5',
  // CSS code-splitting experiment
  '/css-demo/one/ssr', '/css-demo/one/rsc-server', '/css-demo/one/rsc-client',
  '/css-demo/two/ssr', '/css-demo/two/rsc-server', '/css-demo/two/rsc-client',
];


// Answering --list-routes must not need Puppeteer installed: the parity spec runs in
// the Ruby-only specs.yml job, which never runs `pnpm install`.
if (process.argv.includes('--list-routes')) {
  console.log(JSON.stringify(DEFAULT_ROUTES));
  process.exit(0);
}

const puppeteer = require('puppeteer');

// A harness can scope the run to a subset (e.g. just the RSC client-boundary
// routes) via a comma-separated ROUTES env var; default is the full list above.
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',').map((r) => r.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

// The media gallery never goes quiet: its thumbnails and video posters come from
// picsum.photos, and the two players keep media requests alive well past the
// point the page is interactive. `networkidle0` therefore has nothing to settle
// on and burns the whole navigation budget (it timed out at 25s on main in run
// 33426195157). These routes navigate on `domcontentloaded` and use
// checkMediaClientInteraction as their readiness signal instead, which is a
// stricter gate than a quiet network: it does not pass until the client island's
// handlers are attached.
const PERSISTENT_MEDIA_ROUTES = new Set(['/media-gallery', '/media-gallery/rsc']);

// Deliberately count-agnostic. LightboxThumbGrid labels each thumbnail
// `Open image <n> of <total> in the <label> lightbox`, so pinning <total> would
// silently stop matching if MediaGalleryData::RIL_IMAGE_IDS changed length. The
// label segment is what disambiguates the two grids on the page.
const MEDIA_RIL_THUMBNAIL_SELECTOR =
  'button[aria-label^="Open image 1 of "][aria-label$=" in the react-image-lightbox lightbox"]';
// react-image-lightbox 5.1.4 renders its close button with aria-label={closeLabel},
// whose default value is this string.
const MEDIA_RIL_CLOSE_SELECTOR = 'button[aria-label="Close lightbox"]';

// yet-another-react-lightbox v3 renders nothing while closed, mounts a portal
// under .yarl__root when opened, and labels its close control `Close` (not
// `Close lightbox`, which is the other library's). Scoping the close selector to
// the portal keeps it from matching any future page-level `Close` button.
const MEDIA_YARL_THUMBNAIL_SELECTOR =
  'button[aria-label^="Open image 1 of "][aria-label$=" in the yet-another-react-lightbox lightbox"]';
const MEDIA_YARL_ROOT_SELECTOR = '.yarl__root';
const MEDIA_YARL_CLOSE_SELECTOR = '.yarl__root button[aria-label="Close"]';

// ReactPlayerLightVideo server-renders only a poster <img> and defers
// `import('react-player')` to a post-hydration effect. The library's light-mode
// preview element is therefore proof of both: the island hydrated and its chunk
// resolved. Matching the class rather than the aria-label keeps this independent
// of MediaGalleryData's video titles.
const MEDIA_REACT_PLAYER_PREVIEW_SELECTOR = '.react-player__preview';

// VanillaHlsVideo renders its click-to-load facade as the <video>'s next
// sibling, and swaps to a controls-bearing <video> once activated. Anchoring on
// the DOM shape rather than the aria-label keeps these title-agnostic too.
const MEDIA_HLS_FACADE_SELECTOR = 'video[preload="none"] + button[aria-label^="Play "]';
const MEDIA_HLS_ACTIVE_SELECTOR = 'figure video[controls]';

// A failed request for one of our own bundles means the page is running with
// part of its client code missing -- the exact defect the island checks below
// are built to catch, and the one network signal worth failing a route over.
// Third-party URLs stay out of it: picsum and mux 404s are noise we do not
// control. `/packs/` is the production build the hosted smoke serves;
// `/packs-test/` is what a local test-mode stack serves.
const OWN_BUNDLE_PATH = /^\/packs(-test)?\//;

// Renaming a media route would otherwise drop it back to `networkidle0` and
// quietly take its hydration check with it, so refuse to run instead.
for (const mediaRoute of PERSISTENT_MEDIA_ROUTES) {
  if (!DEFAULT_ROUTES.includes(mediaRoute)) {
    throw new Error(
      `PERSISTENT_MEDIA_ROUTES lists ${mediaRoute}, which is no longer in DEFAULT_ROUTES`
    );
  }
}

// React minified-error codes that mean a hydration mismatch
const HYDRATION_ERROR_CODES = new Set(['418', '419', '420', '421', '422', '423', '425']);

function classify(text, locationUrl = '') {
  if (!text) return null;
  if (/ReactOnRails was already initialized/i.test(text)) return 'ror-init';
  if (/Cannot access ['"][^'"]+['"] before initialization/i.test(text)) return 'tdz';
  const m = text.match(/Minified React error #(\d+)/);
  if (m && HYDRATION_ERROR_CODES.has(m[1])) return `hydration-#${m[1]}`;
  if (m) return `react-#${m[1]}`;
  if (/Hydration failed/i.test(text)) return 'hydration-failed';
  if (/Text content does not match/i.test(text)) return 'hydration-text-mismatch';
  // A load failure for one of our own bundles is a real defect, not the
  // third-party noise the `other` bucket exists to absorb, so it gets a kind of
  // its own that the `ok` computation counts.
  if (/Failed to load resource/i.test(text)) {
    return OWN_BUNDLE_PATH.test(locationUrl.replace(BASE, '')) ? 'asset-load' : 'other';
  }
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
  // focus + assert, rather than click and hope: if the input never took focus
  // the Enter keypress below would go to the document and the failure would
  // surface later as an unexplained missing navigation.
  await page.focus(inputSelector);
  const inputIsFocused = await page.evaluate(
    (selector) => document.activeElement === document.querySelector(selector),
    inputSelector
  );
  if (!inputIsFocused) {
    throw new Error('search input did not receive focus');
  }

  // The explicit API waits below are the readiness gate for the updated search
  // page; waiting for all network activity to stop is broader than the
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

const MEDIA_ISLAND_TIMEOUT_MS = 25000;
const MEDIA_ISLAND_POLL_MS = 100;

// Both thumbnail grids ship in the server HTML, so a clean load proves nothing
// about their islands; only an open/close round trip does. Both phases re-issue
// the click on a poll because a single click can land before the island's
// handlers are attached, and both clicks are idempotent (open sets the same
// index, close clears it).
async function checkLightboxRoundTrip(page, { name, thumbnailSelector, openSelector, closeSelector }) {
  // Separate from the retry loops so a missing grid reports as a server-render
  // problem instead of masquerading as a 25s hydration timeout.
  try {
    await page.waitForSelector(thumbnailSelector, { visible: true, timeout: 10000 });
  } catch (e) {
    throw new Error(`${name} thumbnail never rendered: ${e.message}`);
  }

  try {
    await page.waitForFunction(
      (selectors) => {
        if (document.querySelector(selectors.openSelector)) return true;

        const thumbnail = document.querySelector(selectors.thumbnailSelector);
        if (typeof thumbnail?.click === 'function') thumbnail.click();
        return false;
      },
      { timeout: MEDIA_ISLAND_TIMEOUT_MS, polling: MEDIA_ISLAND_POLL_MS },
      { thumbnailSelector, openSelector }
    );
  } catch (e) {
    throw new Error(
      `${name} did not open within ${MEDIA_ISLAND_TIMEOUT_MS}ms `
        + `(client island handlers never attached?): ${e.message}`
    );
  }

  try {
    await page.waitForFunction(
      (selectors) => {
        const close = document.querySelector(selectors.closeSelector);
        if (!close) return true;

        if (typeof close.click === 'function') close.click();
        return false;
      },
      { timeout: MEDIA_ISLAND_TIMEOUT_MS, polling: MEDIA_ISLAND_POLL_MS },
      { closeSelector }
    );
  } catch (e) {
    throw new Error(`${name} did not close within ${MEDIA_ISLAND_TIMEOUT_MS}ms: ${e.message}`);
  }
}

// react-player is never server-rendered: ReactPlayerLightVideo ships a poster
// <img> and calls import('react-player') from a post-hydration effect. So the
// library's light-mode preview element existing at all is proof that the island
// hydrated and that its deferred chunk resolved. No click is needed, which
// deliberately keeps this check off the remote stream.
async function checkReactPlayerIsland(page) {
  try {
    await page.waitForSelector(MEDIA_REACT_PLAYER_PREVIEW_SELECTOR, {
      visible: true,
      timeout: MEDIA_ISLAND_TIMEOUT_MS,
    });
  } catch (e) {
    throw new Error(
      'react-player light-mode preview never rendered '
        + `within ${MEDIA_ISLAND_TIMEOUT_MS}ms (deferred react-player chunk unresolved?): ${e.message}`
    );
  }
}

// VanillaHlsVideo defers both hls.js and the media bytes until its facade is
// clicked, so an unclicked page never exercises that dynamic import. Clicking it
// flips React state (facade unmounts, <video> gains controls) and starts the
// import; the second wait then proves the chunk actually arrived from our own
// origin. Nothing here waits on the remote stream or on playback, so a slow or
// blocked media host cannot fail the gate.
async function checkVanillaHlsIsland(page) {
  try {
    await page.waitForSelector(MEDIA_HLS_FACADE_SELECTOR, { visible: true, timeout: 10000 });
  } catch (e) {
    throw new Error(`hls.js video facade never rendered: ${e.message}`);
  }

  try {
    await page.waitForFunction(
      (selectors) => {
        if (document.querySelector(selectors.activeSelector)) return true;

        const facade = document.querySelector(selectors.facadeSelector);
        if (typeof facade?.click === 'function') facade.click();
        return false;
      },
      { timeout: MEDIA_ISLAND_TIMEOUT_MS, polling: MEDIA_ISLAND_POLL_MS },
      { facadeSelector: MEDIA_HLS_FACADE_SELECTOR, activeSelector: MEDIA_HLS_ACTIVE_SELECTOR }
    );
  } catch (e) {
    throw new Error(
      `hls.js video facade never activated within ${MEDIA_ISLAND_TIMEOUT_MS}ms `
        + `(client island handlers never attached?): ${e.message}`
    );
  }

  try {
    await page.waitForFunction(
      (origin) => performance
        .getEntriesByType('resource')
        .some((entry) => entry.name.startsWith(origin)
          && /hls/i.test(entry.name)
          // A 404 still produces a resource entry, so presence alone would pass
          // on a missing chunk. responseStatus is same-origin-readable in
          // Chrome 109+; where it is missing, fall back to presence and let the
          // own-bundle failure check below carry the signal.
          && (entry.responseStatus === undefined || entry.responseStatus === 200)),
      { timeout: MEDIA_ISLAND_TIMEOUT_MS, polling: MEDIA_ISLAND_POLL_MS },
      new URL(BASE).origin
    );
  } catch (e) {
    throw new Error(
      `hls.js chunk never loaded from this origin within ${MEDIA_ISLAND_TIMEOUT_MS}ms `
        + `(dynamic import chunk missing?): ${e.message}`
    );
  }
}

// The media gallery renders four client islands. #199 covered the first one;
// #219 added the other three, each of which defers its real work until an
// interaction, so a broken chunk for any of them used to be invisible here.
async function checkMediaClientInteraction(page) {
  await checkLightboxRoundTrip(page, {
    name: 'react-image-lightbox gallery',
    thumbnailSelector: MEDIA_RIL_THUMBNAIL_SELECTOR,
    openSelector: MEDIA_RIL_CLOSE_SELECTOR,
    closeSelector: MEDIA_RIL_CLOSE_SELECTOR,
  });
  await checkLightboxRoundTrip(page, {
    name: 'yet-another-react-lightbox gallery',
    thumbnailSelector: MEDIA_YARL_THUMBNAIL_SELECTOR,
    openSelector: MEDIA_YARL_ROOT_SELECTOR,
    closeSelector: MEDIA_YARL_CLOSE_SELECTOR,
  });
  await checkReactPlayerIsland(page);
  await checkVanillaHlsIsland(page);
}

async function checkRoute(browser, route) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const bundleFailures = [];
  // One missing chunk raises both a 404 response and an aborted request, so
  // record each URL once to keep the failure report readable.
  const recordBundleFailure = (path, reason) => {
    if (!OWN_BUNDLE_PATH.test(path)) return;
    if (bundleFailures.some((failure) => failure.url === path)) return;

    bundleFailures.push({ url: path, reason });
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Chrome puts the failing URL in the message *location*, not the text
      // ("Failed to load resource: the server responded with a status of 404"),
      // so the own-bundle carve-out has to read it from there.
      const locationUrl = msg.location()?.url || '';
      const isOwnBundle = OWN_BUNDLE_PATH.test(locationUrl.replace(BASE, ''));
      // Skip known-noisy network 404s for missing static assets we don't control
      if (text.includes('Failed to load resource') && !isOwnBundle) return;
      consoleErrors.push({ type: msg.type(), text, url: locationUrl, kind: classify(text, locationUrl) });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack, kind: classify(err.message) });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    // Ignore third-party image preloads from picsum that sometimes 404
    if (!url.startsWith(BASE)) return;

    const path = url.replace(BASE, '');
    const failure = { url: path, reason: req.failure()?.errorText };
    failedRequests.push(failure);
    recordBundleFailure(path, failure.reason);
  });
  // requestfailed only fires for network-level failures, so a 404 on one of our
  // own chunks -- the likeliest way to lose client code -- needs the response
  // side too.
  page.on('response', (resp) => {
    const url = resp.url();
    if (!url.startsWith(BASE) || resp.status() < 400) return;

    recordBundleFailure(url.replace(BASE, ''), `HTTP ${resp.status()}`);
  });

  let httpStatus = null;
  let interactionError = null;
  try {
    // Every other route keeps the stricter networkidle0 condition; see
    // PERSISTENT_MEDIA_ROUTES for why the media pages cannot use it.
    const waitUntil = PERSISTENT_MEDIA_ROUTES.has(route) ? 'domcontentloaded' : 'networkidle0';
    const resp = await page.goto(BASE + route, { waitUntil, timeout: 25000 });
    httpStatus = resp ? resp.status() : null;
  } catch (e) {
    await page.close().catch(() => {});
    return {
      route, httpStatus, ok: false, navError: e.message,
      bodyTextLength: 0, hasErrorPanel: false,
      duplicateScripts: [],
      consoleErrors, pageErrors, failedRequests, bundleFailures,
    };
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

  if (PERSISTENT_MEDIA_ROUTES.has(route)) {
    try {
      await checkMediaClientInteraction(page);
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
      consoleErrors, pageErrors, failedRequests, bundleFailures,
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
    && interactionError === null
    && bundleFailures.length === 0;

  return {
    route, httpStatus, ok,
    interactionError,
    bodyTextLength, hasErrorPanel,
    duplicateScripts: dupes,
    consoleErrors, pageErrors, failedRequests, bundleFailures,
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
      process.stderr.write(r.ok ? 'OK\n' : `FAIL (status=${r.httpStatus} pageErrors=${r.pageErrors.length} consoleErrs=${r.consoleErrors.filter(e=>e.kind!=='other').length} bundleFails=${(r.bundleFailures || []).length} dupes=${r.duplicateScripts.length})\n`);
      results.push(r);
    }
  } finally {
    // Without this a throw from the loop leaves Chromium running and the
    // process hanging instead of reporting the failure. Swallowing close()'s
    // own rejection matters just as much: if Chromium died mid-loop then one of
    // checkRoute's unguarded page.evaluate calls threw AND close() will reject
    // too, and an exception raised inside `finally` REPLACES the in-flight one
    // — trading the real diagnostic for an opaque protocol error.
    await browser.close().catch((closeError) => {
      process.stderr.write(`warning: browser.close() failed: ${closeError.message}\n`);
    });
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
    for (const f of r.bundleFailures || []) {
      console.log(`  own-bundle-failure: ${f.url} (${f.reason})`);
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

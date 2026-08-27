import { SELECTORS, DEFAULTS, THROTTLE, MOBILE } from './constants.mjs';
import { getCollectorScript } from './collectors.mjs';

/**
 * Measure a single page load.
 * @param {import('puppeteer').Browser} browser
 * @param {{ path: string, label: string, hasStreaming: boolean, scroll?: boolean, selectors?: object }} pageConfig
 * @param {{ baseUrl: string, timeout: number, throttle: boolean, verbose: boolean, mobile?: boolean, query?: string }} options
 * @returns {Promise<object>} Raw metrics for one run
 */
export async function measurePage(browser, pageConfig, options) {
  const { baseUrl, timeout, throttle, verbose, mobile, query } = options;
  const pagePath = query
    ? `${pageConfig.path}${pageConfig.path.includes('?') ? '&' : '?'}${query}`
    : pageConfig.path;
  const url = `${baseUrl}${pagePath}`;

  const context = await browser.createBrowserContext();
  try {
    return await measureInContext(context, pageConfig, options, pagePath, url);
  } finally {
    // A lane failure (e.g. missing declared interaction target) must not leak
    // the per-run incognito context — the caller keeps the browser alive for
    // the remaining lanes.
    await context.close().catch(() => {});
  }
}

async function measureInContext(context, pageConfig, options, pagePath, url) {
  const { timeout, throttle, verbose, mobile } = options;
  const page = await context.newPage();

  if (mobile) {
    await page.setUserAgent(MOBILE.userAgent);
    await page.setViewport(MOBILE.viewport);
  }

  const cdp = await page.createCDPSession();

  // Disable cache so each run is a cold load
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.enable');

  // Apply throttling if requested
  if (throttle) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpu });
    await cdp.send('Network.emulateNetworkConditions', THROTTLE.network);
  }

  // Track JS resources via CDP
  const jsResources = new Map();

  cdp.on('Network.responseReceived', (params) => {
    const { response, requestId } = params;
    if (
      response.mimeType &&
      (response.mimeType.includes('javascript') || response.mimeType.includes('ecmascript'))
    ) {
      jsResources.set(requestId, {
        url: response.url,
        transferSize: response.encodedDataLength || 0,
        decodedBodySize: 0,
      });
    }
  });

  cdp.on('Network.loadingFinished', (params) => {
    const { requestId, encodedDataLength } = params;
    if (jsResources.has(requestId)) {
      const entry = jsResources.get(requestId);
      entry.transferSize = encodedDataLength || entry.transferSize;
    }
  });

  cdp.on('Network.dataReceived', (params) => {
    const { requestId, dataLength } = params;
    if (jsResources.has(requestId)) {
      jsResources.get(requestId).decodedBodySize += dataLength;
    }
  });

  // Inject performance collectors before navigation
  await page.evaluateOnNewDocument(getCollectorScript(pageConfig.selectors));

  if (verbose) {
    console.log(`  Navigating to ${url}`);
  }

  // Navigate — use 'networkidle2' to handle RSC streaming pages
  // that keep connections open during chunked transfer
  await page.goto(url, { waitUntil: 'networkidle2', timeout });

  // Wait for hydration to complete (poll with timeout)
  await page.waitForFunction(
    () => window.__vitals && window.__vitals.hydrationDuration !== null,
    { timeout },
  ).catch(() => {
    if (verbose) console.log('  Hydration detection timed out');
  });

  // For RSC pages, wait for streaming content to resolve
  if (pageConfig.hasStreaming) {
    await page.waitForFunction(
      () => window.__vitals && window.__vitals.streamingDuration !== null,
      { timeout: 10_000 },
    ).catch(() => {
      if (verbose) console.log('  Streaming detection timed out');
    });
  }

  // Small pause to let event observers settle
  await sleep(200);

  // Optional scripted scroll cycle (issue #184): to the bottom of the page and
  // back, sampling DOM node counts and the JS heap along the way. Long tasks
  // and long animation frames raised while the cycle runs are collected as
  // scroll-phase metrics instead of TBT (see collectors.mjs).
  const scrollMetrics = pageConfig.scroll ? await runScrollCycle(page, cdp) : {};

  // Click the interaction target for INP measurement. Lanes whose config
  // declares a selector require it to resolve — silently skipping would just
  // report "no INP" and mask a broken lane.
  const btnSelector = pageConfig.selectors?.likeButton || SELECTORS.likeButton;
  const anchorText = pageConfig.selectors?.interactionAnchorText;
  if (anchorText) {
    // Bring the target section into view first — on virtualized lanes the
    // button only exists once the row is mounted near the viewport.
    await page.evaluate((text) => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const target = headings.find((h) => h.textContent && h.textContent.includes(text));
      if (target) target.scrollIntoView({ block: 'start' });
    }, anchorText);
  }

  const declared = Boolean(pageConfig.selectors?.likeButton);
  const found = declared
    ? await page.waitForSelector(btnSelector, { timeout: 5_000 }).then(() => true).catch(() => false)
    : (await page.$(btnSelector)) !== null;

  if (!found && declared) {
    throw new Error(
      `Interaction target "${btnSelector}" not found on ${pageConfig.label} (${pagePath}) — ` +
        'a lane that declares selectors.likeButton must be able to click it.',
    );
  }

  if (found) {
    // Click through fresh viewport coordinates with a real (trusted) input
    // event: element handles can go stale when a virtualized row remounts
    // between query and click, and ElementHandle.click misfires under mobile
    // emulation. Synthetic element.click() would not count for INP.
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center' });
    }, btnSelector);
    await sleep(250); // let the scroll (and any row remounting) settle
    const point = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, btnSelector);
    if (point) {
      await page.mouse.click(point.x, point.y);
      await sleep(300); // let event timing observer capture
    } else if (declared) {
      throw new Error(
        `Interaction target "${btnSelector}" disappeared before the click on ${pageConfig.label} (${pagePath}).`,
      );
    }
  } else if (verbose) {
    console.log('  Like button not found');
  }

  // Harvest metrics from the page
  const vitals = await page.evaluate(() => {
    const v = window.__vitals;
    return {
      fcp: v.fcp,
      lcp: v.lcp,
      cls: v.cls,
      ttfb: v.ttfb,
      tbt: v.tbt,
      inp: v.inp,
      hydrationDuration: v.hydrationDuration,
      streamingDuration: v.streamingDuration,
    };
  });

  // Compute JS sizes from CDP data
  const resources = Array.from(jsResources.values());
  const jsTransferSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
  const jsDecodedSize = resources.reduce((sum, r) => sum + r.decodedBodySize, 0);

  return {
    ...vitals,
    ...scrollMetrics,
    jsTransferSize,
    jsDecodedSize,
    jsResources: resources.map((r) => ({
      url: r.url,
      transferSize: r.transferSize,
      decodedBodySize: r.decodedBodySize,
    })),
  };
}

const SCROLL_STEP_PAUSE_MS = 80;
// Absolute safety valve only. The per-leg step allowance ADAPTS to the
// measured document height (2x headroom, re-derived every step because a
// virtualized list corrects its geometry mid-scroll), so a taller page gets
// more steps instead of a silent truncation. A page needing more than the
// hard cap (~an hour-long fling) fails the lane loudly instead.
const SCROLL_HARD_CAP_STEPS = 1200;

function stepAllowance(docHeight, step) {
  return Math.min(SCROLL_HARD_CAP_STEPS, Math.ceil(docHeight / step) * 2 + 10);
}

async function countDomNodes(page) {
  return page.evaluate(() => document.getElementsByTagName('*').length);
}

async function sampleHeapUsed(page, cdp) {
  // GC first so retained size is compared, not allocation noise.
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  await sleep(150);
  return page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
}

async function runScrollCycle(page, cdp) {
  await cdp.send('HeapProfiler.enable').catch(() => {});

  const domNodesPostHydration = await countDomNodes(page);
  const heapUsedPostLoad = await sampleHeapUsed(page, cdp);

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const step = Math.max(600, Math.round(viewportHeight * 2.5));

  // Wheel events need a mouse position over the page.
  const { width, height } = page.viewport() ?? { width: 800, height: 600 };
  await page.mouse.move(width / 2, height / 2);

  await page.evaluate(() => window.__vitals.beginScrollPhase());
  const started = Date.now();

  // Down. The document can GROW while a virtualized list corrects its
  // geometry, so both the bottom and the step allowance are re-derived every
  // step.
  let downSteps = 0;
  let reachedBottom = false;
  let maxBottomSeen = 0;
  let docHeight = 0;
  for (;;) {
    const { bottom, max } = await page.evaluate(() => ({
      bottom: window.scrollY + window.innerHeight,
      max: document.documentElement.scrollHeight,
    }));
    docHeight = max;
    if (bottom > maxBottomSeen) maxBottomSeen = bottom;
    if (bottom >= max - 4) {
      reachedBottom = true;
      break;
    }
    if (downSteps >= stepAllowance(max, step)) break;
    await page.mouse.wheel({ deltaY: step });
    downSteps += 1;
    await sleep(SCROLL_STEP_PAUSE_MS);
  }
  await sleep(300); // dwell at the bottom
  const domNodesAtBottom = await countDomNodes(page);

  // And back up.
  let upSteps = 0;
  let reachedTop = false;
  for (;;) {
    const y = await page.evaluate(() => window.scrollY);
    if (y <= 4) {
      reachedTop = true;
      break;
    }
    if (upSteps >= stepAllowance(docHeight, step)) break;
    await page.mouse.wheel({ deltaY: -step });
    upSteps += 1;
    await sleep(SCROLL_STEP_PAUSE_MS);
  }
  await sleep(300); // let observers flush before the phase flag drops
  await page.evaluate(() => window.__vitals.endScrollPhase());
  const scrollDuration = Date.now() - started;

  // An incomplete traversal must fail the lane (the R1 isolation records it),
  // never masquerade as bottom-of-page numbers.
  const scrollCoverage = docHeight > 0 ? Math.min(1, maxBottomSeen / docHeight) : 0;
  if (!reachedBottom || !reachedTop) {
    throw new Error(
      `Scroll cycle incomplete (reachedBottom=${reachedBottom}, reachedTop=${reachedTop}): ` +
        `covered ${Math.round(maxBottomSeen)} of ${Math.round(docHeight)}px ` +
        `(${(scrollCoverage * 100).toFixed(1)}%) in ${downSteps}+${upSteps} steps of ${step}px — ` +
        `bottom-of-page metrics would be fiction, so the lane fails instead.`,
    );
  }

  const domNodesPostScroll = await countDomNodes(page);
  const heapUsedPostScroll = await sampleHeapUsed(page, cdp);

  const scrollVitals = await page.evaluate(() => ({
    scrollLongTaskTime: window.__vitals.scrollLongTaskTime,
    scrollLongTaskCount: window.__vitals.scrollLongTaskCount,
    scrollLoafTime: window.__vitals.scrollLoafTime,
    scrollLoafCount: window.__vitals.scrollLoafCount,
    scrollLoafMax: window.__vitals.scrollLoafMax,
  }));

  return {
    ...scrollVitals,
    domNodesPostHydration,
    domNodesAtBottom,
    domNodesPostScroll,
    heapUsedPostLoad,
    heapUsedPostScroll,
    scrollDuration,
    scrollSteps: downSteps + upSteps,
    scrollCycleComplete: 1,
    scrollCoverage,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

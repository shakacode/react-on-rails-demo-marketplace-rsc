import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELECTORS } from './constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the web-vitals IIFE bundle once at module load.
// This attaches onFCP, onLCP, onCLS, onINP, onTTFB to window.webVitals.
const webVitalsSource = readFileSync(
  join(__dirname, '../../node_modules/web-vitals/dist/web-vitals.iife.js'),
  'utf-8',
);

/**
 * Returns a JavaScript string to inject via page.evaluateOnNewDocument().
 * Uses the web-vitals library for FCP, LCP, CLS, INP, TTFB.
 * Manually handles TBT (longtask), hydration detection, and streaming detection.
 */
export function getCollectorScript(overrides = {}) {
  const likeSelector = overrides.likeButton || SELECTORS.likeButton;
  const headingSelector = SELECTORS.relatedPostsHeading;
  const headingText = overrides.relatedHeadingText || SELECTORS.relatedPostsText;
  // Hydration is detected on any element React attaches fibers to. Lanes whose
  // interaction target may not exist at load (virtualized lists mount buttons
  // lazily) declare a separate always-present hydration target.
  const hydrationSelector = overrides.hydrationTarget || likeSelector;

  return `
    // Inject web-vitals IIFE — creates window.webVitals
    ${webVitalsSource}

    window.__vitals = {
      fcp: null,
      lcp: null,
      cls: null,
      ttfb: null,
      tbt: 0,
      inp: null,
      hydrationDuration: null,
      streamingDuration: null,
      _hydrationStart: null,
      _streamingStart: null,
      // Scroll-phase metrics (issue #184). INP cannot see scrolling — the
      // Event Timing API observes only clicks/taps/keys — so scroll jank is
      // measured directly: long tasks and long animation frames that happen
      // while the runner's scripted scroll cycle is active. The phase flag
      // also keeps scroll long-tasks OUT of TBT, so load-phase TBT is not
      // double-counted with scroll work.
      scrollLongTaskTime: 0,
      scrollLongTaskCount: 0,
      scrollLoafTime: 0,
      scrollLoafCount: 0,
      scrollLoafMax: 0,
      _scrollPhase: false,
    };

    window.__vitals.beginScrollPhase = () => { window.__vitals._scrollPhase = true; };
    window.__vitals.endScrollPhase = () => { window.__vitals._scrollPhase = false; };

    // --- web-vitals library callbacks (accurate metric definitions) ---

    webVitals.onFCP((metric) => {
      window.__vitals.fcp = metric.value;
    }, { reportAllChanges: true });

    webVitals.onLCP((metric) => {
      window.__vitals.lcp = metric.value;
    }, { reportAllChanges: true });

    webVitals.onCLS((metric) => {
      window.__vitals.cls = metric.value;
    }, { reportAllChanges: true });

    webVitals.onINP((metric) => {
      window.__vitals.inp = metric.value;
    }, { reportAllChanges: true });

    webVitals.onTTFB((metric) => {
      window.__vitals.ttfb = metric.value;
    });

    // --- Manual: TBT (not covered by web-vitals) ---
    // During the scripted scroll cycle, long tasks are attributed to the
    // scroll-phase metrics instead of TBT (see beginScrollPhase above).

    const tbtObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const blocking = entry.duration - 50;
        if (blocking > 0) {
          if (window.__vitals._scrollPhase) {
            window.__vitals.scrollLongTaskTime += blocking;
            window.__vitals.scrollLongTaskCount += 1;
          } else {
            window.__vitals.tbt += blocking;
          }
        }
      }
    });
    try { tbtObserver.observe({ type: 'longtask', buffered: true }); } catch {}

    // --- Manual: long animation frames during the scroll phase ---
    // LoAF catches rendering-pipeline jank (style/layout/paint) that longtask
    // misses; blockingDuration is the over-50ms share of each frame.

    const loafObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!window.__vitals._scrollPhase) continue;
        window.__vitals.scrollLoafTime += entry.blockingDuration ?? Math.max(0, entry.duration - 50);
        window.__vitals.scrollLoafCount += 1;
        window.__vitals.scrollLoafMax = Math.max(window.__vitals.scrollLoafMax, entry.duration);
      }
    });
    try { loafObserver.observe({ type: 'long-animation-frame', buffered: false }); } catch {}

    // --- Manual: Streaming + Hydration detection ---
    // Both deferred to DOMContentLoaded because document.documentElement
    // is null when evaluateOnNewDocument runs (before document creation).

    window.__vitals._streamingStart = performance.now();

    document.addEventListener('DOMContentLoaded', () => {
      // Streaming detection (RSC Suspense boundary)
      const streamObserver = new MutationObserver(() => {
        const headings = document.querySelectorAll('${headingSelector}');
        for (const h of headings) {
          if (h.textContent && h.textContent.includes('${headingText}')) {
            window.__vitals.streamingDuration = performance.now() - window.__vitals._streamingStart;
            streamObserver.disconnect();
            return;
          }
        }
      });
      streamObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      // Check if streaming content already arrived during HTML parsing
      const headings = document.querySelectorAll('${headingSelector}');
      for (const h of headings) {
        if (h.textContent && h.textContent.includes('${headingText}')) {
          window.__vitals.streamingDuration = performance.now() - window.__vitals._streamingStart;
          streamObserver.disconnect();
          break;
        }
      }

      // Hydration detection (React fiber polling)
      window.__vitals._hydrationStart = performance.now();

      function checkHydration() {
        const btn = document.querySelector('${hydrationSelector}');
        if (btn) {
          const keys = Object.keys(btn);
          const hasFiber = keys.some(
            (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')
          );
          if (hasFiber) {
            window.__vitals.hydrationDuration =
              performance.now() - window.__vitals._hydrationStart;
            return;
          }
        }
        requestAnimationFrame(checkHydration);
      }
      requestAnimationFrame(checkHydration);
    });
  `;
}

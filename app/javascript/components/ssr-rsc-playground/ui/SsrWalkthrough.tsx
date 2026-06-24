'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  description: string;
  playMs: number;
  pauseMs: number;
  marker?: string;
  markerColor?: string;
}

const STEPS: Step[] = [
  {
    id: 'start',
    label: 'Page Requested',
    description: 'Browser sends request to CDN edge. The full HTML page is cached — no server round-trip needed.',
    playMs: 800,
    pauseMs: 0,
  },
  {
    id: 'downloading',
    label: 'Downloading',
    description:
      "HTML, CSS, and JS start downloading in parallel. The browser's preload scanner finds <link> and <script> tags in <head> and begins fetching CSS and JS while HTML is still arriving.",
    playMs: 1200,
    pauseMs: 0,
  },
  {
    id: 'fcp',
    label: 'First Contentful Paint',
    description:
      'ALL CSS in <head> must finish downloading before the browser can paint anything. Once CSS is ready, the browser renders whatever HTML has arrived so far — but nothing is interactive.',
    playMs: 400,
    pauseMs: 3000,
    marker: 'FCP',
    markerColor: '#f59e0b',
  },
  {
    id: 'html-rendering',
    label: 'Progressive Rendering',
    description:
      "More HTML bytes arrive, more sections appear on screen — top to bottom, just like any document download. Everything renders gray because the page isn't hydrated yet.",
    playMs: 1800,
    pauseMs: 0,
  },
  {
    id: 'html-complete',
    label: 'HTML Complete',
    description:
      'Full page is visible but entirely non-interactive. Lazy-loaded components (menu items) show skeleton placeholders. The JS bundle is still being parsed.',
    playMs: 400,
    pauseMs: 3000,
    marker: 'HTML Done',
    markerColor: '#3b82f6',
  },
  {
    id: 'hydrating',
    label: 'Hydrating',
    description:
      'One monolithic pass: Parse JS bundle → Deserialize ALL component props → Build GraphQL data cache → Re-execute entire React tree → Attach event handlers. Nothing is interactive until every step finishes.',
    playMs: 1800,
    pauseMs: 0,
  },
  {
    id: 'hydrated',
    label: 'Interactive!',
    description:
      'The page is now interactive — buttons work, forms submit! But lazy-loaded menu items still show skeletons. They need their own GraphQL data fetched from the server.',
    playMs: 400,
    pauseMs: 3000,
    marker: 'TTI',
    markerColor: '#10b981',
  },
  {
    id: 'lazy-fetch',
    label: 'Lazy Data Fetch',
    description:
      'GraphQL queries fire for lazy-loaded menu items. The component JS chunks were already preloaded via <script> tags in the HTML — only the data was missing.',
    playMs: 1200,
    pauseMs: 0,
  },
  {
    id: 'complete',
    label: 'Fully Loaded',
    description:
      "All content rendered with real data. Every section waited for every other section — CSS blocked paint, hydration blocked interactivity, data fetch blocked content — that's the cascading cost of SSR.",
    playMs: 400,
    pauseMs: 3000,
    marker: 'Done',
    markerColor: '#6366f1',
  },
];

// ── Timing computation ───────────────────────────────────────────────────────

interface StepTiming {
  step: Step;
  index: number;
  effStart: number;
  effEnd: number;
  wallStart: number;
  wallPauseAt: number;
  wallEnd: number;
}

const TIMINGS: StepTiming[] = (() => {
  const result: StepTiming[] = [];
  let eff = 0;
  let wall = 0;
  STEPS.forEach((step, index) => {
    result.push({
      step,
      index,
      effStart: eff,
      effEnd: eff + step.playMs,
      wallStart: wall,
      wallPauseAt: wall + step.playMs,
      wallEnd: wall + step.playMs + step.pauseMs,
    });
    eff += step.playMs;
    wall += step.playMs + step.pauseMs;
  });
  return result;
})();

const TOTAL_WALL = TIMINGS[TIMINGS.length - 1].wallEnd;

function wallToEff(wallMs: number): number {
  for (const t of TIMINGS) {
    if (wallMs <= t.wallPauseAt) return t.effStart + (wallMs - t.wallStart);
    if (wallMs <= t.wallEnd) return t.effEnd;
  }
  return TIMINGS[TIMINGS.length - 1].effEnd;
}

function getTimingAt(wallMs: number): StepTiming {
  for (const t of TIMINGS) {
    if (wallMs < t.wallEnd) return t;
  }
  return TIMINGS[TIMINGS.length - 1];
}

function isPausedAt(wallMs: number): boolean {
  const t = getTimingAt(wallMs);
  return wallMs >= t.wallPauseAt && t.step.pauseMs > 0;
}

function pauseRemaining(wallMs: number): number {
  if (!isPausedAt(wallMs)) return 0;
  const t = getTimingAt(wallMs);
  return Math.max(0, t.wallEnd - wallMs);
}

// ── Network resources ────────────────────────────────────────────────────────

interface Resource {
  name: string;
  size: string;
  color: string;
  startEff: number;
  endEff: number;
}

const RESOURCES: Resource[] = [
  { name: 'document.html', size: '133 KB', color: '#3b82f6', startEff: 0, endEff: TIMINGS[4].effEnd },
  { name: 'styles.css', size: '73 KB', color: '#a855f7', startEff: 80, endEff: TIMINGS[2].effEnd },
  { name: 'bundle.js', size: '300 KB', color: '#f59e0b', startEff: 80, endEff: TIMINGS[5].effEnd },
  { name: 'menu-chunk.js', size: '45 KB', color: '#fb923c', startEff: 150, endEff: TIMINGS[3].effEnd - 300 },
  { name: 'reviews-chunk.js', size: '30 KB', color: '#fb923c', startEff: 180, endEff: TIMINGS[3].effEnd - 500 },
  { name: 'gql: menuItems', size: '12 KB', color: '#ec4899', startEff: TIMINGS[6].effEnd, endEff: TIMINGS[7].effEnd },
];

function getProgress(r: Resource, effMs: number): number {
  if (effMs <= r.startEff) return 0;
  if (effMs >= r.endEff) return 1;
  return (effMs - r.startEff) / (r.endEff - r.startEff);
}

// ── Section reveal timing ────────────────────────────────────────────────────

const FCP_EFF = TIMINGS[2].effEnd;
const SECTION_REVEALS = [
  FCP_EFF - 150,
  FCP_EFF + 250,
  FCP_EFF + 650,
  FCP_EFF + 950,
  FCP_EFF + 1250,
  FCP_EFF + 1550,
];

function countVisible(effMs: number): number {
  return SECTION_REVEALS.filter((t) => effMs >= t).length;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SsrWalkthrough() {
  const [wallMs, setWallMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const perfStartRef = useRef(0);
  const offsetRef = useRef(0);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - perfStartRef.current;
    const next = Math.min(offsetRef.current + elapsed, TOTAL_WALL);
    setWallMs(next);
    if (next >= TOTAL_WALL) {
      setIsPlaying(false);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      perfStartRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return stopRaf;
  }, [isPlaying, tick, stopRaf]);

  const play = useCallback(() => {
    if (wallMs >= TOTAL_WALL) {
      offsetRef.current = 0;
      setWallMs(0);
    } else {
      offsetRef.current = wallMs;
    }
    setIsPlaying(true);
  }, [wallMs]);

  const pause = useCallback(() => {
    offsetRef.current = wallMs;
    setIsPlaying(false);
  }, [wallMs]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    offsetRef.current = 0;
    setWallMs(0);
  }, []);

  const jumpTo = useCallback(
    (idx: number) => {
      stopRaf();
      const target = TIMINGS[idx].wallPauseAt;
      offsetRef.current = target;
      setWallMs(target);
      setIsPlaying(false);
    },
    [stopRaf]
  );

  // Derived state
  const effMs = wallToEff(wallMs);
  const current = getTimingAt(wallMs);
  const paused = isPausedAt(wallMs);
  const pauseLeft = pauseRemaining(wallMs);
  const numVisible = countVisible(effMs);
  const isGray = effMs < TIMINGS[6].effEnd;
  const lazyLoaded = effMs >= TIMINGS[7].effEnd;
  const isHydrating = effMs >= TIMINGS[4].effEnd && effMs < TIMINGS[6].effEnd;
  const hydrationProgress = isHydrating
    ? (effMs - TIMINGS[4].effEnd) / (TIMINGS[6].effEnd - TIMINGS[4].effEnd)
    : effMs >= TIMINGS[6].effEnd
      ? 1
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* ── Step progress bar ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-0.5 mb-3">
          {STEPS.map((step, i) => {
            const t = TIMINGS[i];
            const isActive = current.index === i;
            const isDone = wallMs >= t.wallEnd;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => jumpTo(i)}
                  title={step.label}
                  className={`relative w-7 h-7 rounded-full text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer flex-shrink-0
                    ${isActive ? 'bg-indigo-600 text-white scale-110 ring-2 ring-indigo-200' : isDone ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                >
                  {i + 1}
                  {step.marker && (isDone || isActive) && (
                    <span
                      className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] font-bold whitespace-nowrap px-1 rounded"
                      style={{ color: step.markerColor }}
                    >
                      {step.marker}
                    </span>
                  )}
                </button>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 min-w-[8px] ${isDone ? 'bg-indigo-200' : 'bg-slate-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{current.step.label}</span>
            {current.step.marker && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: (current.step.markerColor || '#666') + '18', color: current.step.markerColor }}
              >
                {current.step.marker}
              </span>
            )}
          </div>
          {paused && <span className="text-[11px] text-slate-400 animate-pulse">Continuing in {Math.ceil(pauseLeft / 1000)}s...</span>}
        </div>
      </div>

      {/* ── Network waterfall ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider uppercase">Network</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>
        <div className="space-y-1">
          {RESOURCES.map((r) => {
            const p = getProgress(r, effMs);
            const started = effMs >= r.startEff;
            const done = p >= 1;
            if (!started && effMs < r.startEff - 400) return null;
            return (
              <div key={r.name} className="flex items-center gap-2 h-[18px]">
                <span className={`text-[9px] font-mono w-[120px] text-right truncate transition-colors ${started ? 'text-slate-300' : 'text-slate-600'}`}>
                  {r.name}
                </span>
                <div className="flex-1 relative h-[10px] bg-slate-800 rounded-sm overflow-hidden">
                  {started && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${Math.max(p * 100, 1)}%`,
                        backgroundColor: r.color,
                        opacity: done ? 1 : 0.7,
                        transition: 'width 80ms linear',
                      }}
                    />
                  )}
                </div>
                <span className={`text-[8px] font-mono w-14 text-right ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                  {done ? r.size : started ? `${Math.round(p * parseInt(r.size))} KB` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Browser mockup ────────────────────────────────────────────────── */}
      <div className="border-t border-slate-700">
        <div className="h-7 bg-gradient-to-b from-slate-600 to-slate-700 flex items-center px-3 gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-green-400/80" />
          <div className="flex-1 mx-4">
            <div className="bg-slate-800/60 rounded px-2 py-0.5 text-[8px] text-slate-400 text-center">bellas-pizza.com/order</div>
          </div>
        </div>

        <div className="relative min-h-[380px] bg-white">
          {/* Page content with grayscale filter */}
          <div className="transition-[filter] duration-700" style={{ filter: isGray && numVisible > 0 ? 'grayscale(1) brightness(0.92)' : 'none' }}>
            {/* Blank state */}
            {numVisible === 0 && (
              <div className="h-[380px] flex items-center justify-center">
                <div className="text-sm text-slate-300">{effMs < 200 ? 'Requesting page...' : 'Downloading HTML...'}</div>
              </div>
            )}

            {/* Header */}
            {numVisible >= 1 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 text-sm font-bold">B</div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">Bella&apos;s Pizza</div>
                      <div className="text-[10px] text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9734; 4.2 &middot; Open &middot; $$</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {['Menu', 'Reviews', 'Info'].map((t) => (
                      <span key={t} className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-500 font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Menu Grid */}
            {numVisible >= 2 && (
              <div className="px-4 py-3">
                <div className="text-[11px] font-bold text-slate-700 mb-2">Popular Items</div>
                <div className="grid grid-cols-3 gap-2">
                  {lazyLoaded
                    ? [
                        { name: 'Margherita', price: '$12.99', bg: 'bg-red-50', border: 'border-red-100', accent: 'text-red-600' },
                        { name: 'Pepperoni', price: '$14.99', bg: 'bg-orange-50', border: 'border-orange-100', accent: 'text-orange-600' },
                        { name: 'Caesar Salad', price: '$10.99', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'text-emerald-600' },
                        { name: 'Garlic Bread', price: '$6.99', bg: 'bg-amber-50', border: 'border-amber-100', accent: 'text-amber-600' },
                        { name: 'Tiramisu', price: '$8.99', bg: 'bg-yellow-50', border: 'border-yellow-100', accent: 'text-yellow-700' },
                        { name: 'Gelato', price: '$5.99', bg: 'bg-sky-50', border: 'border-sky-100', accent: 'text-sky-600' },
                      ].map((item) => (
                        <div key={item.name} className={`${item.bg} rounded-lg border ${item.border} p-2 text-center`}>
                          <div className={`w-full h-7 ${item.bg} rounded mb-1 flex items-center justify-center`}>
                            <div className={`w-5 h-5 rounded-full ${item.bg} border ${item.border}`} />
                          </div>
                          <div className="text-[8px] font-semibold text-slate-700">{item.name}</div>
                          <div className={`text-[8px] font-bold ${item.accent}`}>{item.price}</div>
                        </div>
                      ))
                    : Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-2 animate-pulse">
                          <div className="w-full h-7 bg-slate-200 rounded mb-1" />
                          <div className="h-2 bg-slate-200 rounded w-3/4 mx-auto mb-1" />
                          <div className="h-2 bg-slate-200 rounded w-1/2 mx-auto" />
                        </div>
                      ))}
                </div>
              </div>
            )}

            {/* Cart Widget */}
            {numVisible >= 3 && (
              <div className="px-4 py-2">
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-[10px] font-bold">C</div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-700">Your Cart (2 items)</div>
                      <div className="text-[8px] text-slate-400">Margherita, Pepperoni</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-slate-800">$27.98</div>
                    <div className="text-[8px] bg-indigo-600 text-white rounded px-1.5 py-0.5 font-semibold">Checkout</div>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Info */}
            {numVisible >= 4 && (
              <div className="px-4 py-1.5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-[8px] text-slate-400">T</div>
                  <span className="font-medium">Est. 25&ndash;35 min</span>
                  <span className="text-slate-300">&middot;</span>
                  <span className="text-emerald-600 font-medium">Free delivery over $30</span>
                </div>
              </div>
            )}

            {/* Reviews */}
            {numVisible >= 5 && (
              <div className="px-4 py-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">Customer Reviews</div>
                    <div className="text-[9px] text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9734; &middot; 142 reviews</div>
                  </div>
                  <span className="text-[9px] text-indigo-500 font-medium">See all &#8594;</span>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {numVisible >= 6 && (
              <div className="px-4 py-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[11px] font-bold text-slate-700">Recommended for you</div>
                  <span className="text-[9px] text-indigo-500 font-medium">&#8594;</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-1 h-10 bg-slate-50 rounded-lg border border-slate-100" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Overlays (not affected by grayscale) ──────────────────────── */}

          {/* "Not Interactive" badge */}
          {isGray && numVisible > 0 && (
            <div className="absolute top-3 right-3 bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm border border-red-200 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-400 rounded-full" />
              Not Interactive
            </div>
          )}

          {/* "Interactive" badge */}
          {!isGray && numVisible > 0 && (
            <div className="absolute top-3 right-3 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Interactive
            </div>
          )}

          {/* Hydration progress bar */}
          {isHydrating && numVisible > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-50/90 to-transparent px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-150" style={{ width: `${hydrationProgress * 100}%` }} />
                </div>
                <span className="text-[10px] text-indigo-600 font-semibold whitespace-nowrap min-w-[130px]">
                  {hydrationProgress < 0.2
                    ? 'Parsing JS bundle...'
                    : hydrationProgress < 0.4
                      ? 'Deserializing props...'
                      : hydrationProgress < 0.6
                        ? 'Building GQL cache...'
                        : hydrationProgress < 0.85
                          ? 'React hydrating...'
                          : 'Attaching handlers...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Step description ──────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 bg-amber-50/50 border-t border-amber-100/50">
        <p className="text-[13px] text-slate-700 leading-relaxed">{current.step.description}</p>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
        <button
          onClick={isPlaying ? pause : play}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {isPlaying ? 'Pause' : wallMs >= TOTAL_WALL ? 'Replay Walkthrough' : wallMs > 0 ? 'Resume' : 'Play Walkthrough'}
        </button>
        {wallMs > 0 && (
          <button onClick={reset} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Reset
          </button>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400 font-mono">
          Step {current.index + 1} / {STEPS.length}
        </span>
      </div>
    </div>
  );
}

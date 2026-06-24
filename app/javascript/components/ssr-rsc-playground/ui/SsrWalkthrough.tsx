'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Bandwidth simulation ─────────────────────────────────────────────────────
// Models real browser behavior: resources are discovered at different times
// (preload scanner parses <head>, then body), and bandwidth is shared equally
// among all concurrent downloads (HTTP/2 multiplexing).

interface ResourceDef {
  name: string;
  sizeKb: number;
  label: string;
  color: string;
  discoverEff: number;
}

interface BwSegment {
  startEff: number;
  endEff: number;
  startKb: number;
  endKb: number;
}

interface SimResource extends ResourceDef {
  endEff: number;
  segments: BwSegment[];
}

function simulateBandwidth(defs: ResourceDef[], totalBw: number): SimResource[] {
  const state = defs.map((d) => ({
    ...d,
    remaining: d.sizeKb,
    downloaded: 0,
    done: false,
    endEff: 0,
    segments: [] as BwSegment[],
  }));

  let t = 0;
  while (state.some((s) => !s.done) && t < 100000) {
    const active = state.filter((s) => t >= s.discoverEff && !s.done);
    if (active.length === 0) {
      const next = state
        .filter((s) => !s.done)
        .sort((a, b) => a.discoverEff - b.discoverEff)[0];
      if (!next) break;
      t = next.discoverEff;
      continue;
    }
    const bwEach = totalBw / active.length;
    let dt = Infinity;
    for (const r of active) dt = Math.min(dt, r.remaining / bwEach);
    const pending = state
      .filter((s) => !s.done && s.discoverEff > t)
      .sort((a, b) => a.discoverEff - b.discoverEff);
    if (pending.length > 0 && pending[0].discoverEff - t < dt) dt = pending[0].discoverEff - t;

    for (const r of active) {
      const kb = bwEach * dt;
      r.segments.push({ startEff: t, endEff: t + dt, startKb: r.downloaded, endKb: r.downloaded + kb });
      r.downloaded += kb;
      r.remaining -= kb;
      if (r.remaining < 0.01) {
        r.done = true;
        r.endEff = t + dt;
        r.remaining = 0;
      }
    }
    t += dt;
  }
  return state;
}

function getProgress(res: SimResource, effMs: number): number {
  if (effMs <= res.discoverEff) return 0;
  if (effMs >= res.endEff) return 1;
  for (const seg of res.segments) {
    if (effMs <= seg.endEff) {
      const frac = (effMs - seg.startEff) / (seg.endEff - seg.startEff);
      return (seg.startKb + (seg.endKb - seg.startKb) * frac) / res.sizeKb;
    }
  }
  return 1;
}

// ── Resource definitions & simulation run ────────────────────────────────────

const DOWNLOAD_DEFS: ResourceDef[] = [
  { name: 'document.html', sizeKb: 200, label: '200 KB', color: '#3b82f6', discoverEff: 0 },
  { name: 'styles.css', sizeKb: 85, label: '85 KB', color: '#a855f7', discoverEff: 300 },
  { name: 'bundle.js', sizeKb: 300, label: '300 KB', color: '#f59e0b', discoverEff: 400 },
  { name: 'menu-chunk.js', sizeKb: 45, label: '45 KB', color: '#fb923c', discoverEff: 1000 },
  { name: 'reviews-chunk.js', sizeKb: 30, label: '30 KB', color: '#fb923c', discoverEff: 1100 },
];

const SIM = simulateBandwidth(DOWNLOAD_DEFS, 0.12);

const HTML_RES = SIM.find((r) => r.name === 'document.html')!;
const CSS_RES = SIM.find((r) => r.name === 'styles.css')!;
const JS_RES = SIM.find((r) => r.name === 'bundle.js')!;

const FCP_EFF = Math.ceil(CSS_RES.endEff);
const HTML_DONE_EFF = Math.ceil(HTML_RES.endEff);
const JS_DONE_EFF = Math.ceil(JS_RES.endEff);
const HYDRATION_MS = 1600;
const TTI_EFF = JS_DONE_EFF + HYDRATION_MS;
const LAZY_FETCH_MS = 1200;
const COMPLETE_EFF = TTI_EFF + LAZY_FETCH_MS;

const GQL_RES: SimResource = {
  name: 'gql: menuItems',
  sizeKb: 12,
  label: '12 KB',
  color: '#ec4899',
  discoverEff: TTI_EFF,
  endEff: COMPLETE_EFF,
  segments: [{ startEff: TTI_EFF, endEff: COMPLETE_EFF, startKb: 0, endKb: 12 }],
};

const ALL_RESOURCES = [...SIM, GQL_RES];

// ── Section visibility ───────────────────────────────────────────────────────
// Sections appear as HTML bytes arrive, but only AFTER CSS finishes (FCP).

const REVEAL_THRESHOLDS = [0.3, 0.4, 0.5, 0.65, 0.78, 0.93];

function countVisible(effMs: number): number {
  if (effMs < CSS_RES.endEff) return 0;
  const htmlProg = getProgress(HTML_RES, effMs);
  return REVEAL_THRESHOLDS.filter((t) => htmlProg >= t).length;
}

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

const MILESTONE_PAUSE = 3000;
const STEP_PAUSE = 2000;
const TRANS = 100;

const INIT_MS = Math.max(200, DOWNLOAD_DEFS[1].discoverEff - 100);

const STEPS: Step[] = [
  {
    id: 'start',
    label: 'Page Requested',
    description: 'Browser sends GET request to the CDN edge. The full SSR HTML is cached — no Rails server round-trip.',
    playMs: INIT_MS,
    pauseMs: STEP_PAUSE,
  },
  {
    id: 'downloading',
    label: 'Downloading Resources',
    description:
      "HTML downloads first. The browser's preload scanner finds <link> and <script> in <head> → CSS and JS start. Later, lazy component <script> tags in the body are discovered and share bandwidth with everything else.",
    playMs: FCP_EFF - INIT_MS,
    pauseMs: STEP_PAUSE,
  },
  {
    id: 'fcp',
    label: 'First Contentful Paint',
    description:
      "ALL CSS in <head> must finish before the browser can paint anything. Now CSS is ready — the browser paints whatever HTML has arrived. Content is gray because JS hasn't hydrated the page yet.",
    playMs: TRANS,
    pauseMs: MILESTONE_PAUSE,
    marker: 'FCP',
    markerColor: '#f59e0b',
  },
  {
    id: 'html-rendering',
    label: 'Progressive Rendering',
    description:
      'More HTML bytes arrive, more sections paint — top to bottom, like any document. Everything stays gray and non-interactive. Lazy components show skeleton placeholders.',
    playMs: HTML_DONE_EFF - FCP_EFF - TRANS,
    pauseMs: STEP_PAUSE,
  },
  {
    id: 'html-complete',
    label: 'HTML Complete',
    description:
      'Full page visible but entirely non-interactive. Lazy-loaded components (menu items) show skeleton placeholders. The JS bundle is still downloading.',
    playMs: TRANS,
    pauseMs: MILESTONE_PAUSE,
    marker: 'HTML Done',
    markerColor: '#3b82f6',
  },
  {
    id: 'hydrating',
    label: 'Waiting for JS & Hydrating',
    description:
      'JS bundle finishes downloading → Parse JS → Deserialize ALL props → Build GraphQL cache → Re-execute entire React tree → Attach handlers. Nothing interactive until this monolithic pass completes.',
    playMs: TTI_EFF - HTML_DONE_EFF - TRANS,
    pauseMs: STEP_PAUSE,
  },
  {
    id: 'hydrated',
    label: 'Interactive!',
    description:
      'Hydration complete — buttons work, forms submit! But lazy-loaded menu items still show skeletons. Their JS chunks were preloaded, but they need GraphQL data from the server.',
    playMs: TRANS,
    pauseMs: MILESTONE_PAUSE,
    marker: 'TTI',
    markerColor: '#10b981',
  },
  {
    id: 'lazy-fetch',
    label: 'Lazy Data Fetch',
    description:
      'GraphQL queries fire for menu items. The component chunks were already preloaded via <script> tags in the initial HTML — only the data was missing.',
    playMs: COMPLETE_EFF - TTI_EFF - TRANS,
    pauseMs: STEP_PAUSE,
  },
  {
    id: 'complete',
    label: 'Fully Loaded',
    description:
      "All content rendered. Every section waited for every other — CSS blocked paint, JS blocked interactivity, data fetch blocked content. That's the cascading cost of SSR.",
    playMs: TRANS,
    pauseMs: MILESTONE_PAUSE,
    marker: 'Done',
    markerColor: '#6366f1',
  },
];

// ── Timing computation ──────────────────────────────────────────────────────

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
    const next = Math.min(offsetRef.current + performance.now() - perfStartRef.current, TOTAL_WALL);
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

  const effMs = wallToEff(wallMs);
  const current = getTimingAt(wallMs);
  const paused = isPausedAt(wallMs);
  const pauseLeft = pauseRemaining(wallMs);
  const numVisible = countVisible(effMs);
  const isGray = effMs < TTI_EFF;
  const lazyLoaded = effMs >= COMPLETE_EFF;
  const isHydrating = effMs >= JS_DONE_EFF && effMs < TTI_EFF;
  const hydrationProgress = isHydrating ? (effMs - JS_DONE_EFF) / HYDRATION_MS : effMs >= TTI_EFF ? 1 : 0;
  const waitingForJs = effMs >= HTML_DONE_EFF + TRANS && effMs < JS_DONE_EFF;
  const overallProgress = wallMs / TOTAL_WALL;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* ── Progress bar with milestone markers ──────────────────────── */}
      <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
        <div className="relative h-2 bg-slate-200 rounded-full overflow-visible mb-6">
          <div
            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
            style={{ width: `${overallProgress * 100}%`, transition: 'width 60ms linear' }}
          />
          {STEPS.filter((s) => s.marker).map((s) => {
            const t = TIMINGS[STEPS.indexOf(s)];
            const pos = (t.wallPauseAt / TOTAL_WALL) * 100;
            const reached = wallMs >= t.wallPauseAt;
            return (
              <div key={s.id} className="absolute" style={{ left: `${pos}%`, top: '-3px' }}>
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm -translate-x-1/2 transition-colors ${reached ? '' : 'bg-slate-300'}`}
                  style={reached ? { backgroundColor: s.markerColor } : undefined}
                />
                <span
                  className="absolute top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap"
                  style={{ color: reached ? s.markerColor : '#94a3b8' }}
                >
                  {s.marker}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
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
          {paused && (
            <span className="text-[11px] text-slate-400 animate-pulse">Continuing in {Math.ceil(pauseLeft / 1000)}s...</span>
          )}
        </div>
      </div>

      {/* ── Network waterfall ─────────────────────────────────────────── */}
      <div className="bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider uppercase">Network</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>
        <div className="space-y-1">
          {ALL_RESOURCES.map((r) => {
            const discovered = effMs >= r.discoverEff;
            const approaching = effMs >= r.discoverEff - 300;
            const done = effMs >= r.endEff;
            if (!approaching) return null;

            const barLeft = (r.discoverEff / COMPLETE_EFF) * 100;
            const currentEnd = Math.min(effMs, r.endEff);
            const barWidth = discovered ? ((currentEnd - r.discoverEff) / COMPLETE_EFF) * 100 : 0;

            return (
              <div key={r.name} className="flex items-center gap-2 h-[18px]">
                <span
                  className={`text-[9px] font-mono w-[120px] text-right truncate transition-colors ${discovered ? 'text-slate-300' : 'text-slate-600'}`}
                >
                  {r.name}
                </span>
                <div className="flex-1 relative h-[10px] bg-slate-800 rounded-sm overflow-hidden">
                  {barWidth > 0 && (
                    <div
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        left: `${barLeft}%`,
                        width: `${Math.max(barWidth, 0.3)}%`,
                        backgroundColor: r.color,
                        opacity: done ? 1 : 0.7,
                        transition: 'width 60ms linear',
                      }}
                    />
                  )}
                </div>
                <span className={`text-[8px] font-mono w-14 text-right ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                  {done ? r.label : discovered ? `${Math.round(getProgress(r, effMs) * r.sizeKb)} KB` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Browser mockup ────────────────────────────────────────────── */}
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
          <div
            className="transition-[filter] duration-700"
            style={{ filter: isGray && numVisible > 0 ? 'grayscale(1) brightness(0.92)' : 'none' }}
          >
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
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 text-sm font-bold">
                      B
                    </div>
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
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                      C
                    </div>
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

          {/* ── Overlays ────────────────────────────────────────────────── */}
          {isGray && numVisible > 0 && (
            <div className="absolute top-3 right-3 bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm border border-red-200 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-400 rounded-full" />
              Not Interactive
            </div>
          )}

          {!isGray && numVisible > 0 && (
            <div className="absolute top-3 right-3 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Interactive
            </div>
          )}

          {/* Waiting for JS overlay */}
          {waitingForJs && numVisible > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-100/90 to-transparent px-4 py-3">
              <span className="text-[10px] text-slate-500 font-medium">Waiting for JS bundle to finish downloading...</span>
            </div>
          )}

          {/* Hydration progress bar */}
          {isHydrating && numVisible > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-50/90 to-transparent px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                    style={{ width: `${hydrationProgress * 100}%` }}
                  />
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

      {/* ── Description ───────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 bg-amber-50/50 border-t border-amber-100/50">
        <p className="text-[13px] text-slate-700 leading-relaxed">{current.step.description}</p>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
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
      </div>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Bandwidth simulation ─────────────────────────────────────────────────────

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

const REVEAL_THRESHOLDS = [0.3, 0.4, 0.5, 0.65, 0.78, 0.93];

function countVisible(effMs: number): number {
  if (effMs < CSS_RES.endEff) return 0;
  const htmlProg = getProgress(HTML_RES, effMs);
  return REVEAL_THRESHOLDS.filter((t) => htmlProg >= t).length;
}

// ── Step definitions ─────────────────────────────────────────────────────────

const TRANS = 100;
const INIT_MS = Math.max(200, DOWNLOAD_DEFS[1].discoverEff - 100);
const TOTAL_EFF = COMPLETE_EFF + TRANS;

interface StepNote {
  title: string;
  body: string;
  insight: string;
}

interface Step {
  id: string;
  label: string;
  effEnd: number;
  marker?: string;
  markerColor?: string;
  note: StepNote;
}

const STEPS: Step[] = [
  {
    id: 'start',
    label: 'Page Requested',
    effEnd: INIT_MS,
    note: {
      title: 'The Request',
      body: 'The browser sends a GET request to the CDN edge. With SSR, the entire pre-rendered HTML is cached there — no round-trip to your Rails server. The response starts streaming immediately.',
      insight:
        'But the browser can’t display anything yet. It needs to download HTML first, discover CSS and JS referenced in the <head>, and wait for ALL CSS to finish before it can paint a single pixel.',
    },
  },
  {
    id: 'downloading',
    label: 'Downloading Resources',
    effEnd: FCP_EFF,
    note: {
      title: 'Resource Discovery & Bandwidth Sharing',
      body: 'HTML starts downloading first. As the browser parses <head>, its preload scanner discovers <link> and <script> tags — CSS and JS begin downloading. Lazy component <script> tags deeper in <body> are found even later.',
      insight:
        'All concurrent downloads share the same bandwidth via HTTP/2 multiplexing. Watch how bars slow down when new downloads start — adding more resources doesn’t just add time, it slows down EVERY other concurrent download.',
    },
  },
  {
    id: 'fcp',
    label: 'First Contentful Paint',
    effEnd: FCP_EFF + TRANS,
    marker: 'FCP',
    markerColor: '#f59e0b',
    note: {
      title: 'CSS Blocks All Painting',
      body: 'The browser CANNOT paint a single pixel until ALL CSS referenced in <head> finishes downloading. Now CSS is ready — the browser paints whatever HTML has arrived so far. Notice the content appears gray and non-interactive.',
      insight:
        'This is the critical bottleneck: every CSS file in <head> delays the entire page’s first paint — not just the section that needs it. In SSR, ALL sections’ CSS lives in <head>, so adding one section’s styles delays EVERY section’s first paint.',
    },
  },
  {
    id: 'html-rendering',
    label: 'Progressive Rendering',
    effEnd: HTML_DONE_EFF,
    note: {
      title: 'HTML Paints Top-to-Bottom',
      body: 'As more HTML bytes stream in, the browser paints more sections — header first, then menu, then cart. The page looks like it’s loading, which gives decent visual feedback.',
      insight:
        'But everything is gray and non-interactive. This is the "uncanny valley" of SSR: the user sees content that looks ready but ignores every click. Buttons don’t respond, forms don’t submit. The page is a screenshot, not an application.',
    },
  },
  {
    id: 'html-complete',
    label: 'HTML Complete',
    effEnd: HTML_DONE_EFF + TRANS,
    marker: 'HTML Done',
    markerColor: '#3b82f6',
    note: {
      title: 'Visible But Completely Frozen',
      body: 'The entire HTML document has arrived. Every section is painted on screen. The page LOOKS finished and ready to use — header, menu, cart, reviews, all visible.',
      insight:
        'But it’s a lie. No button works. No form submits. No dropdown opens. The user sees a "finished" page that ignores every interaction. The JavaScript bundle is still downloading — and the page cannot come alive without it.',
    },
  },
  {
    id: 'hydrating',
    label: 'Waiting for JS & Hydrating',
    effEnd: TTI_EFF,
    note: {
      title: 'The Hydration Tax',
      body: 'The JS bundle finally finishes downloading. React begins "hydration" — re-executing your entire component tree to attach event handlers to the server-rendered HTML. Watch the progress bar at the bottom of the page.',
      insight:
        'Hydration is monolithic and blocking: Parse JS → Deserialize ALL props → Rebuild GraphQL cache → Re-execute ENTIRE React tree → Attach handlers. One slow component blocks everything. No section becomes interactive until the entire tree finishes.',
    },
  },
  {
    id: 'hydrated',
    label: 'Interactive!',
    effEnd: TTI_EFF + TRANS,
    marker: 'TTI',
    markerColor: '#10b981',
    note: {
      title: 'Finally Interactive!',
      body: 'Hydration is complete. The page springs to life — buttons click, forms submit, dropdowns open. The grayscale filter lifts and colors return. But look at the menu — items still show skeleton placeholders.',
      insight:
        'The menu skeletons reveal another waterfall: lazy components’ JS chunks were preloaded, but they need GraphQL data from the server. That data fetch couldn’t even START until JS loaded, parsed, and hydrated. Sequential dependencies, not parallel work.',
    },
  },
  {
    id: 'lazy-fetch',
    label: 'Lazy Data Fetch',
    effEnd: COMPLETE_EFF,
    note: {
      title: 'The Data Waterfall',
      body: 'GraphQL queries fire to fetch menu item data. The component JS chunks were already preloaded via <script> tags in the initial HTML, so the code is ready — only the data was missing.',
      insight:
        'Count the chain: HTML downloaded → JS downloaded → JS parsed → React hydrated → THEN data can be fetched. Each step depends on the previous one. The user waits for a waterfall of sequential work, not parallel execution.',
    },
  },
  {
    id: 'complete',
    label: 'Fully Loaded',
    effEnd: COMPLETE_EFF + TRANS,
    marker: 'Done',
    markerColor: '#6366f1',
    note: {
      title: 'The Cascading Cost of SSR',
      body: 'Every section is finally rendered with real data. Menu items appear with names and prices. The page is truly complete — it took the full cascade to get here.',
      insight:
        'The fundamental problem: CSS blocked paint → JS blocked interactivity → hydration blocked data fetch → data blocked content. Every section waited for every other section at every stage. Adding ONE new component slows down the ENTIRE page. This is the architectural cost that RSC solves.',
    },
  },
];

// ── Animation helpers ────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SsrWalkthrough() {
  const [stepIndex, setStepIndex] = useState(-1);
  const [effMs, setEffMs] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopRaf, [stopRaf]);

  const advance = useCallback(() => {
    if (animating) return;
    const next = stepIndex + 1;
    if (next >= STEPS.length) return;

    setNoteVisible(false);
    setStepIndex(next);

    const startEff = effMs;
    const targetEff = STEPS[next].effEnd;
    const effDelta = targetEff - startEff;
    const duration = Math.max(400, Math.min(2500, effDelta * 0.7));
    const startTime = performance.now();

    setAnimating(true);
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      setEffMs(startEff + effDelta * easeOutCubic(progress));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setEffMs(targetEff);
        setAnimating(false);
        setTimeout(() => setNoteVisible(true), 200);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stepIndex, effMs, animating, stopRaf]);

  const goBack = useCallback(() => {
    if (animating || stepIndex <= 0) return;
    stopRaf();
    const prev = stepIndex - 1;
    setStepIndex(prev);
    setEffMs(STEPS[prev].effEnd);
    setAnimating(false);
    setNoteVisible(true);
  }, [stepIndex, animating, stopRaf]);

  const reset = useCallback(() => {
    stopRaf();
    setStepIndex(-1);
    setEffMs(0);
    setAnimating(false);
    setNoteVisible(false);
  }, [stopRaf]);

  const numVisible = countVisible(effMs);
  const isGray = effMs < TTI_EFF;
  const lazyLoaded = effMs >= COMPLETE_EFF;
  const isHydrating = effMs >= JS_DONE_EFF && effMs < TTI_EFF;
  const hydrationProgress = isHydrating ? (effMs - JS_DONE_EFF) / HYDRATION_MS : effMs >= TTI_EFF ? 1 : 0;
  const waitingForJs = effMs >= HTML_DONE_EFF + TRANS && effMs < JS_DONE_EFF;
  const overallProgress = effMs / TOTAL_EFF;
  const currentStep = stepIndex >= 0 ? STEPS[stepIndex] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* ── Progress bar with milestones ──────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
        <div className="relative h-2 bg-slate-200 rounded-full overflow-visible mb-6">
          <div
            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${overallProgress * 100}%` }}
          />
          {STEPS.filter((s) => s.marker).map((s) => {
            const pos = (s.effEnd / TOTAL_EFF) * 100;
            const reached = effMs >= s.effEnd;
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
            {currentStep ? (
              <>
                <span className="text-sm font-bold text-slate-800">{currentStep.label}</span>
                {currentStep.marker && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: (currentStep.markerColor || '#666') + '18',
                      color: currentStep.markerColor,
                    }}
                  >
                    {currentStep.marker}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400">Ready to start</span>
            )}
          </div>
          {animating && (
            <span className="text-[11px] text-indigo-500 font-medium animate-pulse">Loading...</span>
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
            if (stepIndex < 0 || !approaching) return null;

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
            <div className="bg-slate-800/60 rounded px-2 py-0.5 text-[8px] text-slate-400 text-center">
              bellas-pizza.com/order
            </div>
          </div>
        </div>

        <div className="relative min-h-[380px] bg-white">
          <div
            className="transition-[filter] duration-700"
            style={{ filter: isGray && numVisible > 0 ? 'grayscale(1) brightness(0.92)' : 'none' }}
          >
            {numVisible === 0 && (
              <div className="h-[380px] flex items-center justify-center">
                {stepIndex < 0 ? (
                  <div className="text-center px-6">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <svg className="w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      See how SSR loads your restaurant page &mdash; step by step
                    </p>
                    <button
                      onClick={advance}
                      className="px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                    >
                      Start Walkthrough
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-300">
                    {effMs < 200 ? 'Requesting page...' : 'Downloading HTML...'}
                  </div>
                )}
              </div>
            )}

            {numVisible >= 1 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 text-sm font-bold">
                      B
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">Bella&apos;s Pizza</div>
                      <div className="text-[10px] text-amber-500">
                        &#9733;&#9733;&#9733;&#9733;&#9734; 4.2 &middot; Open &middot; $$
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {['Menu', 'Reviews', 'Info'].map((t) => (
                      <span
                        key={t}
                        className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-500 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                    <div className="text-[8px] bg-indigo-600 text-white rounded px-1.5 py-0.5 font-semibold">
                      Checkout
                    </div>
                  </div>
                </div>
              </div>
            )}

            {numVisible >= 4 && (
              <div className="px-4 py-1.5">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-[8px] text-slate-400">
                    T
                  </div>
                  <span className="font-medium">Est. 25&ndash;35 min</span>
                  <span className="text-slate-300">&middot;</span>
                  <span className="text-emerald-600 font-medium">Free delivery over $30</span>
                </div>
              </div>
            )}

            {numVisible >= 5 && (
              <div className="px-4 py-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">Customer Reviews</div>
                    <div className="text-[9px] text-amber-500">
                      &#9733;&#9733;&#9733;&#9733;&#9734; &middot; 142 reviews
                    </div>
                  </div>
                  <span className="text-[9px] text-indigo-500 font-medium">See all &#8594;</span>
                </div>
              </div>
            )}

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

          {/* Overlays */}
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

          {waitingForJs && numVisible > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-100/90 to-transparent px-4 py-3">
              <span className="text-[10px] text-slate-500 font-medium">
                Waiting for JS bundle to finish downloading...
              </span>
            </div>
          )}

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

      {/* ── Floating insight note ─────────────────────────────────────── */}
      {stepIndex >= 0 && (
      <div className="border-t border-slate-200">
          <div className="p-5 bg-gradient-to-b from-slate-50/80 to-white">
            <div
              className={`transition-all duration-400 ease-out ${noteVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
            >
              {currentStep && (
                <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500" />

                  <div className="pl-6 pr-5 py-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-bold text-white bg-indigo-600 px-2.5 py-0.5 rounded-full shadow-sm">
                        {stepIndex + 1} / {STEPS.length}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{currentStep.note.title}</h4>
                    </div>

                    <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{currentStep.note.body}</p>

                    <div className="bg-amber-50/80 border-l-[3px] border-amber-400 rounded-r-lg px-4 py-3 mb-5">
                      <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">
                        Key Insight
                      </div>
                      <p className="text-[12px] text-amber-900/80 leading-relaxed">{currentStep.note.insight}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i < stepIndex
                                ? 'bg-indigo-300'
                                : i === stepIndex
                                  ? 'bg-indigo-600'
                                  : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {stepIndex > 0 && (
                          <button
                            onClick={goBack}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>
                        )}

                        {stepIndex < STEPS.length - 1 ? (
                          <button
                            onClick={advance}
                            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md"
                          >
                            Next
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={reset}
                            className="flex items-center gap-1.5 px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                          >
                            Start Over
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!noteVisible && animating && (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  Simulating...
                </div>
              </div>
            )}
          </div>
      </div>
      )}
    </div>
  );
}

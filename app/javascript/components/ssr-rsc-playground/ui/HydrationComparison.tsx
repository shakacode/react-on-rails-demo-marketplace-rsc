'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ── Timing model ────────────────────────────────────────────────────────────
//
// Both pages have their STATIC HTML cached on CDN (same FCP timing).
// Both show skeletons for dynamic content in the cached HTML.
//
// SSR dynamic content: client-side rendered with loadable components.
//   After hydration → loadable triggers → download chunk → fetch data → render.
//
// RSC dynamic content: SSR'd on origin server via PPR resume().
//   Origin starts rendering the moment the request arrives.
//   HTML chunks stream to browser, client component bundles sent independently.
//
// The 7 steps:
//   1. Browser receives static HTML — content drawn top-down as it downloads
//   2. RSC hydrates client components in static parts BEFORE all HTML downloaded
//   3. Static HTML fully downloaded — both show content + skeletons. RSC has
//      some interactive components, SSR has none.
//   4. RSC receives dynamic HTML from origin. SSR just finished downloading
//      the big JS bundle.
//   5. RSC hydrates dynamic content + gets more chunks. SSR finally hydrated.
//   6. RSC still streaming. SSR is fetching data from server.
//   7. RSC almost done. SSR just received data and is client-rendering.

const TOTAL = 1150;
const SPEED = 0.28;

// ── Shared: same CDN → same HTML download ──────────────────────────────────

const HTML_START = 20;
const HTML_DONE = 130;

// ── SSR timings ─────────────────────────────────────────────────────────────

const SSR_JS_START = 15;
const SSR_JS_READY = 430;    // ~150 KB monolithic bundle (all component code)
const SSR_HYD_END = 660;     // 230ms monolithic hydration (all static components)
const SSR_DYN_CHUNK_END = 760; // loadable component chunks downloaded (~100ms)
const SSR_DATA_END = 1010;   // parallel API calls (slowest ~250ms)
const SSR_RENDER_END = 1060; // client-side render (~50ms)

// ── RSC timings ─────────────────────────────────────────────────────────────

// Client component JS chunks in static shell (small, independent, parallel)
const RSC_CHUNKS_START = 15;
const RSC_CHUNKS_END = 90;   // ~45 KB total across 4-5 small chunks

// Static part: Header has a client component (nav, login button) that
// hydrates BEFORE the full HTML is downloaded
const RSC_HEADER_INT = 75;   // 40KB chunk → 60ms DL + 15ms hydrate
const RSC_SPECIALS_INT = 55; // Server Component → 0 JS → instant on appear

// Origin starts processing dynamic boundaries at request time
const RSC_ORIGIN_START = 25;
const RSC_CART_VIS = 170;
const RSC_CART_INT = 200;     // 30ms hydrate
const RSC_DELIVERY_VIS = 210;
const RSC_DELIVERY_INT = 240;
const RSC_MENU_VIS = 400;
const RSC_MENU_INT = 435;
const RSC_REVIEWS_VIS = 620;
const RSC_REVIEWS_INT = 620;  // Server Component → 0 JS → instant
const RSC_RECS_VIS = 920;
const RSC_RECS_INT = 955;

const RSC_TTI = RSC_RECS_INT;

// ── Component definitions ───────────────────────────────────────────────────

type CState = 'empty' | 'skeleton' | 'visible' | 'hydrating' | 'interactive';

interface CompDef {
  id: string;
  label: string;
  kind: 'static' | 'dynamic';
  appearAt: number;
  rscType: 'client' | 'server';
  rscVisAt: number;
  rscIntAt: number;
}

const COMPS: CompDef[] = [
  { id: 'header', label: 'Header', kind: 'static', appearAt: 35, rscType: 'client', rscVisAt: 35, rscIntAt: RSC_HEADER_INT },
  { id: 'specials', label: 'Specials', kind: 'static', appearAt: 55, rscType: 'server', rscVisAt: 55, rscIntAt: RSC_SPECIALS_INT },
  { id: 'menu', label: 'Menu', kind: 'dynamic', appearAt: 75, rscType: 'client', rscVisAt: RSC_MENU_VIS, rscIntAt: RSC_MENU_INT },
  { id: 'cart', label: 'Cart', kind: 'dynamic', appearAt: 85, rscType: 'client', rscVisAt: RSC_CART_VIS, rscIntAt: RSC_CART_INT },
  { id: 'delivery', label: 'Delivery', kind: 'dynamic', appearAt: 95, rscType: 'client', rscVisAt: RSC_DELIVERY_VIS, rscIntAt: RSC_DELIVERY_INT },
  { id: 'reviews', label: 'Reviews', kind: 'dynamic', appearAt: 105, rscType: 'server', rscVisAt: RSC_REVIEWS_VIS, rscIntAt: RSC_REVIEWS_INT },
  { id: 'recs', label: 'Recs', kind: 'dynamic', appearAt: 115, rscType: 'client', rscVisAt: RSC_RECS_VIS, rscIntAt: RSC_RECS_INT },
];

// ── State derivation ────────────────────────────────────────────────────────

function ssrStates(t: number): CState[] {
  return COMPS.map((c) => {
    if (t < c.appearAt) return 'empty';
    if (c.kind === 'static') {
      if (t >= SSR_HYD_END) return 'interactive';
      if (t >= SSR_JS_READY) return 'hydrating';
      return 'visible';
    }
    // Dynamic: skeleton until loadable triggers → fetch → render
    if (t >= SSR_RENDER_END) return 'interactive';
    if (t >= SSR_HYD_END) return 'hydrating'; // loadable activated, fetching
    return 'skeleton';
  });
}

function rscStates(t: number): CState[] {
  return COMPS.map((c) => {
    if (t < c.appearAt) return 'empty';
    if (c.kind === 'static') {
      if (t >= c.rscIntAt) return 'interactive';
      return 'visible';
    }
    // Dynamic
    if (t >= c.rscIntAt) return 'interactive';
    if (t >= c.rscVisAt) return 'hydrating';
    return 'skeleton';
  });
}

// ── SVG icon components ─────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="8" rx="1.5" fill="#ef4444" opacity="0.9" />
      <path d="M5 7V5a3 3 0 016 0v2" stroke="#ef4444" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="#10b981" opacity="0.9" />
      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="animate-spin">
      <circle cx="8" cy="8" r="6" stroke="#f59e0b" strokeWidth="1.5" opacity="0.3" />
      <path d="M8 2a6 6 0 014.243 1.757" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShimmerBar() {
  return (
    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden w-10">
      <div
        className="h-full w-6 bg-gradient-to-r from-transparent via-slate-300 to-transparent"
        style={{ animation: 'shimmer 1.2s ease-in-out infinite' }}
      />
    </div>
  );
}

// ── Component box ───────────────────────────────────────────────────────────

const STATE_STYLES: Record<CState, { bg: string; border: string }> = {
  empty: { bg: 'bg-white', border: 'border-slate-200' },
  skeleton: { bg: 'bg-slate-50', border: 'border-slate-200' },
  visible: { bg: 'bg-amber-50', border: 'border-amber-300' },
  hydrating: { bg: 'bg-amber-50', border: 'border-orange-400' },
  interactive: { bg: 'bg-emerald-50', border: 'border-emerald-400' },
};

function ComponentBox({ label, state, badge }: { label: string; state: CState; badge?: string }) {
  const s = STATE_STYLES[state];
  return (
    <div className={`rounded-lg border-2 px-2 py-1.5 transition-all duration-200 ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-600 truncate">{label}</span>
        {state === 'empty' && <div className="w-3 h-3" />}
        {state === 'skeleton' && <ShimmerBar />}
        {state === 'visible' && <LockIcon />}
        {state === 'hydrating' && <SpinnerIcon />}
        {state === 'interactive' && <CheckIcon />}
      </div>
      {badge && (
        <div
          className="text-[7px] font-semibold mt-0.5 px-1 py-0.5 rounded inline-block"
          style={{
            backgroundColor:
              badge === '0 JS' || badge === 'Server Component' ? '#ede9fe' :
              badge === 'LOCKED' ? '#fef2f2' :
              badge === 'fetching data...' ? '#fef3c7' : '#ecfdf5',
            color:
              badge === '0 JS' || badge === 'Server Component' ? '#7c3aed' :
              badge === 'LOCKED' ? '#dc2626' :
              badge === 'fetching data...' ? '#b45309' : '#059669',
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

// ── Timeline bars ───────────────────────────────────────────────────────────

function TimelineBar({
  label, start, end, t, color, desc,
}: {
  label: string; start: number; end: number; t: number; color: string; desc?: string;
}) {
  const pctStart = (start / TOTAL) * 100;
  const pctWidth = ((end - start) / TOTAL) * 100;
  const progress = Math.min(1, Math.max(0, (t - start) / (end - start)));
  const filledWidth = pctWidth * progress;

  return (
    <div className="flex items-center gap-1.5 h-5 mb-0.5">
      <span className="text-[8px] text-slate-500 font-medium w-16 text-right shrink-0">{label}</span>
      <div className="flex-1 relative h-3.5 bg-slate-50 rounded-sm overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-sm"
          style={{ left: `${pctStart}%`, width: `${pctWidth}%`, backgroundColor: color, opacity: 0.15 }}
        />
        {filledWidth > 0 && (
          <div
            className="absolute inset-y-0 rounded-sm transition-[width] duration-75"
            style={{ left: `${pctStart}%`, width: `${filledWidth}%`, backgroundColor: color, opacity: 0.7 }}
          />
        )}
        {desc && pctWidth > 6 && (
          <span
            className="absolute text-[7px] font-medium top-0.5"
            style={{ left: `${pctStart + 1}%`, color: progress > 0.3 ? 'white' : '#94a3b8' }}
          >
            {desc}
          </span>
        )}
      </div>
    </div>
  );
}

interface BarSeg { label: string; start: number; end: number; color: string }

function MultiBar({ label, segs, t, desc }: { label: string; segs: BarSeg[]; t: number; desc?: string }) {
  return (
    <div className="flex items-center gap-1.5 h-5 mb-0.5">
      <span className="text-[8px] text-slate-500 font-medium w-16 text-right shrink-0">{label}</span>
      <div className="flex-1 relative h-3.5 bg-slate-50 rounded-sm overflow-hidden">
        {segs.map((seg) => {
          const pctStart = (seg.start / TOTAL) * 100;
          const pctWidth = ((seg.end - seg.start) / TOTAL) * 100;
          const progress = Math.min(1, Math.max(0, (t - seg.start) / (seg.end - seg.start)));
          const filledWidth = pctWidth * progress;
          return (
            <React.Fragment key={seg.label}>
              <div
                className="absolute inset-y-0 rounded-sm"
                style={{ left: `${pctStart}%`, width: `${pctWidth}%`, backgroundColor: seg.color, opacity: 0.12 }}
              />
              {filledWidth > 0 && (
                <div
                  className="absolute inset-y-0 rounded-sm"
                  style={{ left: `${pctStart}%`, width: `${filledWidth}%`, backgroundColor: seg.color, opacity: 0.65 }}
                />
              )}
            </React.Fragment>
          );
        })}
        {desc && (
          <span
            className="absolute text-[7px] font-medium top-0.5 left-[1%]"
            style={{ color: t > (segs[0]?.start ?? 0) + 40 ? 'white' : '#94a3b8' }}
          >
            {desc}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Origin segments (RSC) ───────────────────────────────────────────────────

const ORIGIN_SEGS: BarSeg[] = [
  { label: 'Cart', start: RSC_ORIGIN_START, end: RSC_CART_VIS, color: '#6366f1' },
  { label: 'Del', start: RSC_ORIGIN_START, end: RSC_DELIVERY_VIS, color: '#8b5cf6' },
  { label: 'Menu', start: RSC_ORIGIN_START, end: RSC_MENU_VIS, color: '#3b82f6' },
  { label: 'Reviews', start: RSC_ORIGIN_START, end: RSC_REVIEWS_VIS, color: '#ec4899' },
  { label: 'Recs', start: RSC_ORIGIN_START, end: RSC_RECS_VIS, color: '#14b8a6' },
];

// ── JS chunk segments ───────────────────────────────────────────────────────

const RSC_JS_SEGS: BarSeg[] = [
  { label: 'Hdr', start: RSC_CHUNKS_START, end: 60, color: '#f59e0b' },
  { label: 'Menu', start: RSC_CHUNKS_START, end: 80, color: '#f59e0b' },
  { label: 'Cart', start: RSC_CHUNKS_START, end: 70, color: '#f59e0b' },
  { label: 'Del', start: RSC_CHUNKS_START, end: 55, color: '#f59e0b' },
  { label: 'Recs', start: RSC_CHUNKS_START, end: 65, color: '#f59e0b' },
];

// ── Hydration segments (RSC) ────────────────────────────────────────────────

const RSC_HYD_SEGS: BarSeg[] = [
  { label: 'Hdr', start: RSC_HEADER_INT - 15, end: RSC_HEADER_INT, color: '#10b981' },
  { label: 'Cart', start: RSC_CART_VIS, end: RSC_CART_INT, color: '#10b981' },
  { label: 'Del', start: RSC_DELIVERY_VIS, end: RSC_DELIVERY_INT, color: '#10b981' },
  { label: 'Menu', start: RSC_MENU_VIS, end: RSC_MENU_INT, color: '#10b981' },
  { label: 'Recs', start: RSC_RECS_VIS, end: RSC_RECS_INT, color: '#10b981' },
];

// ── SSR dynamic loading segments ────────────────────────────────────────────

const SSR_DYN_SEGS: BarSeg[] = [
  { label: 'chunks', start: SSR_HYD_END, end: SSR_DYN_CHUNK_END, color: '#8b5cf6' },
  { label: 'fetch', start: SSR_DYN_CHUNK_END, end: SSR_DATA_END, color: '#f97316' },
  { label: 'render', start: SSR_DATA_END, end: SSR_RENDER_END, color: '#06b6d4' },
];

// ── Annotations ─────────────────────────────────────────────────────────────

function getSsrAnnotation(t: number): string {
  if (t < HTML_START) return 'Request sent — CDN responding with cached HTML...';
  if (t < HTML_DONE) return 'Static HTML downloading from CDN — content appearing top-down...';
  if (t < SSR_JS_READY) return `All content + skeletons visible — downloading JS bundle (150 KB, contains ALL component code)...`;
  if (t < SSR_HYD_END) return `JS loaded — hydrating ALL static components at once (monolithic, ${SSR_HYD_END - SSR_JS_READY}ms)... still frozen`;
  if (t < SSR_DYN_CHUNK_END) return 'Static parts interactive! Loadable components triggered — downloading dynamic chunks...';
  if (t < SSR_DATA_END) return 'Dynamic chunks loaded — fetching data from server APIs...';
  if (t < SSR_RENDER_END) return 'Data received — client-side rendering dynamic components...';
  return `Complete at ${SSR_RENDER_END}ms — dynamic content finally visible`;
}

function rscCount(t: number): number {
  return COMPS.filter((c) => t >= c.rscIntAt).length;
}

function getRscAnnotation(t: number): string {
  if (t < HTML_START) return 'Request sent — CDN responds + origin starts rendering dynamic content simultaneously';
  if (t < RSC_SPECIALS_INT) return 'Static HTML downloading — content appearing top-down...';
  if (t < RSC_HEADER_INT) return 'Specials interactive (Server Component, 0 JS)! HTML still downloading...';
  if (t < HTML_DONE) return `Header hydrated — interactive BEFORE full HTML downloaded! (${rscCount(t)}/${COMPS.length} interactive)`;
  if (t < RSC_CART_VIS) return `Static HTML done — ${rscCount(t)}/${COMPS.length} interactive. Waiting for dynamic content from origin...`;
  if (t < RSC_MENU_VIS) return `Cart + Delivery arrived from origin, hydrating... (${rscCount(t)}/${COMPS.length} interactive)`;
  if (t < RSC_MENU_INT + 10) return `Menu content arrived from origin — JS chunk already loaded, hydrating now...`;
  if (t < RSC_REVIEWS_VIS) return `${rscCount(t)}/${COMPS.length} interactive — waiting for Reviews from external API on origin...`;
  if (t < RSC_REVIEWS_VIS + 30) return 'Reviews arrived — Server Component, zero JS, instantly interactive!';
  if (t < RSC_RECS_VIS) return `${rscCount(t)}/${COMPS.length} interactive — Recs ML engine still processing on origin...`;
  if (t < RSC_RECS_INT) return 'Recs HTML arrived from origin — JS chunk was already loaded, hydrating...';
  return `Complete at ${RSC_TTI}ms — each component became interactive independently`;
}

// ── Playhead & time axis ────────────────────────────────────────────────────

function PlayheadMarker({ t }: { t: number }) {
  const pct = (t / TOTAL) * 100;
  return (
    <div className="flex items-center gap-1.5 h-3 mb-1">
      <span className="w-16 shrink-0" />
      <div className="flex-1 relative">
        <div className="absolute w-0.5 h-3 bg-red-500 rounded-full" style={{ left: `${pct}%` }} />
        <div className="absolute -top-0.5 w-2 h-2 bg-red-500 rounded-full" style={{ left: `calc(${pct}% - 3px)` }} />
      </div>
    </div>
  );
}

function TimeAxis() {
  const ticks = [0, 200, 400, 600, 800, 1000];
  return (
    <div className="flex items-center gap-1.5 h-3 mt-1">
      <span className="w-16 shrink-0" />
      <div className="flex-1 relative">
        {ticks.map((ms) => (
          <span
            key={ms}
            className="absolute text-[7px] text-slate-400 font-mono"
            style={{ left: `${(ms / TOTAL) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {ms === 0 ? '0' : `${ms}ms`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Click callout ───────────────────────────────────────────────────────────

function ClickCallout({ t, side }: { t: number; side: 'ssr' | 'rsc' }) {
  const showAt = 300;
  const dur = 400;
  if (t < showAt || t > showAt + dur) return null;
  const p = (t - showAt) / dur;
  const opacity = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;

  if (side === 'ssr') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ opacity }}>
        <div className="bg-red-600 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg shadow-lg">
          User clicks "Add to Cart" — NOTHING HAPPENS
        </div>
      </div>
    );
  }

  if (rscStates(t)[COMPS.findIndex((c) => c.id === 'cart')] !== 'interactive') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ opacity }}>
      <div className="bg-emerald-600 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
        <CheckIcon />
        User clicks "Add to Cart" — works!
      </div>
    </div>
  );
}

// ── Badge logic ─────────────────────────────────────────────────────────────

function getSsrBadge(comp: CompDef, state: CState): string | undefined {
  if (state === 'visible') return 'LOCKED';
  if (comp.kind === 'dynamic' && state === 'hydrating') return 'fetching data...';
  return undefined;
}

function getRscBadge(comp: CompDef, state: CState): string | undefined {
  if (state === 'interactive') {
    if (comp.rscType === 'server') return comp.kind === 'dynamic' ? 'Server Component' : '0 JS';
    return undefined;
  }
  return undefined;
}

// ── Main component ──────────────────────────────────────────────────────────

export default function HydrationComparison() {
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef({ real: 0, sim: 0 });

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(() => {
    if (timeMs >= TOTAL) {
      setTimeMs(0);
      startRef.current = { real: performance.now(), sim: 0 };
    } else {
      startRef.current = { real: performance.now(), sim: timeMs };
    }
    setPlaying(true);
  }, [timeMs]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const elapsed = performance.now() - startRef.current.real;
      const sim = startRef.current.sim + elapsed * SPEED;
      if (sim >= TOTAL) {
        setTimeMs(TOTAL);
        setPlaying(false);
        return;
      }
      setTimeMs(sim);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return stop;
  }, [playing, stop]);

  const reset = useCallback(() => {
    stop();
    setPlaying(false);
    setTimeMs(0);
  }, [stop]);

  const ssrS = ssrStates(timeMs);
  const rscS = rscStates(timeMs);
  const ssrInt = ssrS.filter((s) => s === 'interactive').length;
  const rscInt = rscS.filter((s) => s === 'interactive').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-4 bg-gradient-to-r from-rose-600 to-orange-500">
        <h3 className="text-lg font-bold text-white">Hydration: Monolithic vs Independent Islands</h3>
        <p className="text-rose-100 text-sm mt-1">
          Same cached HTML, same FCP. Watch how each architecture makes the page interactive.
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <button
          onClick={playing ? () => { stop(); setPlaying(false); } : play}
          className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-orange-500 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
        >
          {playing ? 'Pause' : timeMs >= TOTAL ? 'Replay' : 'Play'}
        </button>
        <button onClick={reset} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors">
          Reset
        </button>
        <input
          type="range" min={0} max={TOTAL} step={1} value={timeMs}
          aria-label="Hydration timeline scrubber"
          onChange={(e) => { stop(); setPlaying(false); setTimeMs(parseFloat(e.target.value)); }}
          className="flex-1 h-1.5 accent-rose-500 cursor-pointer"
        />
        <span className="text-[11px] font-mono text-slate-500 w-16 text-right">{Math.round(timeMs)}ms</span>
      </div>

      {/* ── Two-column comparison ── */}
      <div className="grid md:grid-cols-2 divide-x divide-slate-200">
        {/* ── SSR column ── */}
        <div className="p-5">
          <div className="text-center mb-3">
            <div className="text-sm font-bold text-red-700">SSR + Loadable Components</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Static HTML cached • Dynamic = client-side rendered after hydration
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3 relative">
            {COMPS.map((c, i) => (
              <ComponentBox key={c.id} label={c.label} state={ssrS[i]} badge={getSsrBadge(c, ssrS[i])} />
            ))}
            <ClickCallout t={timeMs} side="ssr" />
          </div>

          <div className="text-center mb-3">
            <span className="text-[11px] font-bold" style={{ color: ssrInt === COMPS.length ? '#10b981' : '#ef4444' }}>
              {ssrInt}/{COMPS.length} interactive
            </span>
          </div>

          <div className="text-[10px] text-slate-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 min-h-[44px]">
            {getSsrAnnotation(timeMs)}
          </div>

          <PlayheadMarker t={timeMs} />
          <TimelineBar label="CDN HTML" start={0} end={HTML_DONE} t={timeMs} color="#10b981" desc="static + skeletons" />
          <TimelineBar label="JS Bundle" start={SSR_JS_START} end={SSR_JS_READY} t={timeMs} color="#f59e0b" desc="150 KB — all components" />
          <TimelineBar label="Hydrate" start={SSR_JS_READY} end={SSR_HYD_END} t={timeMs} color="#ef4444" desc="monolithic — all at once" />
          <MultiBar label="Dynamic" segs={SSR_DYN_SEGS} t={timeMs} desc="chunks → fetch → render" />
          <TimeAxis />

          <div className="flex justify-between mt-3 text-[9px]">
            <span className="font-mono">
              <span className="text-slate-400">FCP </span>
              <span className="font-bold" style={{ color: '#059669' }}>{HTML_DONE}ms</span>
            </span>
            <span className="font-mono">
              <span className="text-slate-400">Static TTI </span>
              <span className="text-red-600 font-bold">{SSR_HYD_END}ms</span>
            </span>
            <span className="font-mono">
              <span className="text-slate-400">Full </span>
              <span className="text-red-600 font-bold">{SSR_RENDER_END}ms</span>
            </span>
          </div>
        </div>

        {/* ── RSC column ── */}
        <div className="p-5">
          <div className="text-center mb-3">
            <div className="text-sm font-bold text-emerald-700">RSC + PPR Streaming</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Static shell cached • Dynamic = SSR'd on origin, streamed to browser
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3 relative">
            {COMPS.map((c, i) => (
              <ComponentBox key={c.id} label={c.label} state={rscS[i]} badge={getRscBadge(c, rscS[i])} />
            ))}
            <ClickCallout t={timeMs} side="rsc" />
          </div>

          <div className="text-center mb-3">
            <span className="text-[11px] font-bold" style={{ color: rscInt === COMPS.length ? '#10b981' : '#f59e0b' }}>
              {rscInt}/{COMPS.length} interactive
            </span>
          </div>

          <div className="text-[10px] text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3 min-h-[44px]">
            {getRscAnnotation(timeMs)}
          </div>

          <PlayheadMarker t={timeMs} />
          <TimelineBar label="CDN Shell" start={0} end={HTML_DONE} t={timeMs} color="#10b981" desc="static + skeletons" />
          <MultiBar label="Origin SSR" segs={ORIGIN_SEGS} t={timeMs} desc="starts at request time!" />
          <MultiBar label="JS Chunks" segs={RSC_JS_SEGS} t={timeMs} desc="5 independent, ~45 KB total" />
          <MultiBar label="Hydrate" segs={RSC_HYD_SEGS} t={timeMs} desc="~30ms each, independent" />
          <TimeAxis />

          <div className="flex justify-between mt-3 text-[9px]">
            <span className="font-mono">
              <span className="text-slate-400">FCP </span>
              <span className="font-bold" style={{ color: '#059669' }}>{HTML_DONE}ms</span>
            </span>
            <span className="font-mono">
              <span className="text-slate-400">1st Int </span>
              <span className="text-emerald-600 font-bold">{RSC_SPECIALS_INT}ms</span>
            </span>
            <span className="font-mono">
              <span className="text-slate-400">Full </span>
              <span className="text-emerald-600 font-bold">{RSC_TTI}ms</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Key insights ── */}
      <div className="border-t border-slate-200 bg-gradient-to-r from-rose-50 to-orange-50 px-6 py-5">
        <div className="grid md:grid-cols-3 gap-5 text-[11px]">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="#10b981" opacity="0.7" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="#10b981" opacity="0.4" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="#10b981" opacity="0.5" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="#10b981" opacity="0.3" />
              </svg>
              <span className="font-bold text-slate-700">Selective hydration</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Each client component has its own JS chunk (~8-15 KB). They download in parallel and hydrate
              independently — even <strong>during</strong> the HTML download. Adding more cached content
              doesn't delay existing hydration because each island is independent.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M9 4l4 4-4 4" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-slate-700">Dynamic SSR at request time</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Origin starts rendering dynamic content the moment the request arrives. It does <strong>not</strong> wait
              for the browser to download HTML → JS → hydrate → fetch(). The data fetching and rendering happen
              on the server, in parallel with everything on the client.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#7c3aed" strokeWidth="1.5" />
                <text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#7c3aed">0</text>
              </svg>
              <span className="font-bold text-slate-700">Server Components = zero JS</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Specials and Reviews are Server Components — they ship <strong>zero JavaScript</strong>.
              Interactive the instant their HTML is in the DOM. No hydration, no bundle impact.
              In SSR, even purely presentational components ship their code.
            </p>
          </div>
        </div>
      </div>

      {/* ── Architecture comparison ── */}
      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
            <div className="text-[10px] font-bold text-red-700 mb-1.5">SSR: monolithic bundle + client-side dynamic</div>
            <p className="text-[10px] text-slate-600 leading-relaxed mb-2">
              One 150 KB JS bundle for <strong>all</strong> components. Hydration is monolithic ({SSR_HYD_END - SSR_JS_READY}ms).
              Dynamic content must wait for the full cycle: hydrate → loadable trigger → chunk download → data fetch → render.
            </p>
            <div className="text-[9px] text-red-600 font-semibold bg-red-100/60 rounded px-2 py-1">
              Add a component → bigger bundle → longer hydration → ALL components delayed
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[10px] font-bold text-emerald-700 mb-1.5">RSC: per-island hydration + server-side dynamic</div>
            <p className="text-[10px] text-slate-600 leading-relaxed mb-2">
              Each client component has its own small chunk. Dynamic content is SSR'd on the origin and streamed —
              no client-side data fetching round trip. If a user clicks an unhydrated button,
              React <strong>synchronously hydrates</strong> it.
            </p>
            <div className="text-[9px] text-emerald-600 font-semibold bg-emerald-100/60 rounded px-2 py-1">
              Add a Server Component → 0 JS. Client Component → own chunk, no delay to existing
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

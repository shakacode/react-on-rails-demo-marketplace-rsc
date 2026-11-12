'use client';

import React, { useState } from 'react';
import { BASE_SECTIONS, LOYALTY_SECTION, NETWORK_PROFILES } from '../defaults';

// ── Compute real metrics using the simulation model on slow 3G ──────────────

const NET = NETWORK_PROFILES.slow3g;

function dl(kb: number): number {
  return kb / NET.bandwidthKbMs + NET.rttMs;
}

function computeMetrics(sections: typeof BASE_SECTIONS) {
  const cssKb = sections.reduce((s, sec) => s + sec.cssKb, 0);
  const htmlKb = sections.reduce((s, sec) => s + sec.htmlKb, 0);
  const jsKb = 85 + sections.reduce((s, sec) => s + sec.totalJsKb, 0);
  const propsKb = sections.reduce((s, sec) => s + sec.propsKb, 0);
  const numQueries = sections.filter((s) => s.kind === 'dynamic').length;

  const cdnEnd = 5;
  const htmlEnd = cdnEnd + dl(htmlKb);
  const cssStart = cdnEnd + 3;
  const cssEnd = cssStart + dl(cssKb);
  const jsStart = cdnEnd + 3;
  const jsEnd = jsStart + dl(jsKb);
  const fcpMs = Math.max(htmlEnd, cssEnd);
  const jsParseEnd = jsEnd + jsKb * 0.5;
  const propsEnd = jsParseEnd + 5 + propsKb * 0.005;
  const cacheEnd = propsEnd + numQueries * 15;
  const hydrationStart = Math.max(cacheEnd, fcpMs);
  const hydrationEnd = hydrationStart + sections.length * 70;
  const ttiMs = hydrationEnd;

  return {
    cssKb, htmlKb, jsKb, propsKb,
    fcpMs, ttiMs,
    htmlEnd, cssStart, cssEnd, jsStart, jsEnd,
    hydrationStart, hydrationEnd,
  };
}

const B = computeMetrics(BASE_SECTIONS);
const A = computeMetrics([...BASE_SECTIONS, LOYALTY_SECTION]);

// ── Lazy loading timeline ───────────────────────────────────────────────────

const LAZY_START = B.ttiMs;
const LAZY_CHUNK_DL = dl(LOYALTY_SECTION.totalJsKb);
const LAZY_CHUNK_END = LAZY_START + LAZY_CHUNK_DL;
const LAZY_MOUNT_END = LAZY_CHUNK_END + 30;
const LAZY_DATA_DL = dl(LOYALTY_SECTION.propsKb);
const LAZY_DATA_END = LAZY_MOUNT_END + LAZY_DATA_DL;
const LAZY_VISIBLE = LAZY_DATA_END + 30;
const LAZY_PENALTY = Math.round(LAZY_VISIBLE - B.fcpMs);

// ── Chart data ──────────────────────────────────────────────────────────────

interface Row {
  name: string;
  icon: string;
  color: string;
  gradTo: string;
  start: [number, number];
  end: [number, number];
  sizeLabel: [string, string];
}

const ROWS: Row[] = [
  {
    name: 'CSS',
    icon: '🎨',
    color: '#a855f7',
    gradTo: '#7c3aed',
    start: [B.cssStart, A.cssStart],
    end: [B.cssEnd, A.cssEnd],
    sizeLabel: [`${B.cssKb} KB`, `${A.cssKb} KB`],
  },
  {
    name: 'HTML',
    icon: '📄',
    color: '#3b82f6',
    gradTo: '#2563eb',
    start: [5, 5],
    end: [B.htmlEnd, A.htmlEnd],
    sizeLabel: [`${B.htmlKb} KB`, `${A.htmlKb} KB`],
  },
  {
    name: 'JS Bundle',
    icon: '⚡',
    color: '#f59e0b',
    gradTo: '#d97706',
    start: [B.jsStart, A.jsStart],
    end: [B.jsEnd, A.jsEnd],
    sizeLabel: [`${B.jsKb} KB`, `${A.jsKb} KB`],
  },
  {
    name: 'Hydration',
    icon: '💧',
    color: '#6366f1',
    gradTo: '#4f46e5',
    start: [B.hydrationStart, A.hydrationStart],
    end: [B.hydrationEnd, A.hydrationEnd],
    sizeLabel: [
      `${Math.round(B.hydrationEnd - B.hydrationStart)}ms`,
      `${Math.round(A.hydrationEnd - A.hydrationStart)}ms`,
    ],
  },
];

interface MilestoneData {
  label: string;
  color: string;
  time: [number, number];
}

const MILESTONES: MilestoneData[] = [
  { label: 'FCP', color: '#f59e0b', time: [B.fcpMs, A.fcpMs] },
  { label: 'TTI', color: '#10b981', time: [B.ttiMs, A.ttiMs] },
];

const MAX_T = Math.max(A.ttiMs * 1.12, LAZY_VISIBLE * 1.12);
const MAX_T_ROUNDED = Math.ceil(MAX_T / 1000) * 1000;
const TICK_COUNT = MAX_T_ROUNDED / 1000;

// ── SSR mode data ───────────────────────────────────────────────────────────

const fcpDelta = Math.round(A.fcpMs - B.fcpMs);
const ttiDelta = Math.round(A.ttiMs - B.ttiMs);
const jsDlDelta = Math.round(A.jsEnd - B.jsEnd);
const htmlDlDelta = Math.round(A.htmlEnd - B.htmlEnd);
const hydDelta = Math.round(
  (A.hydrationEnd - A.hydrationStart) - (B.hydrationEnd - B.hydrationStart),
);

const SSR_CHAINS = [
  {
    icon: '⚡',
    trigger: { text: `+${A.jsKb - B.jsKb} KB JS`, color: '#f59e0b' },
    effects: [
      { text: `Download +${jsDlDelta}ms`, color: '#8b5cf6' },
      { text: `Hydration +${hydDelta}ms`, color: '#6366f1' },
      { text: `TTI +${ttiDelta}ms`, color: '#10b981' },
    ],
  },
  {
    icon: '📄',
    trigger: { text: `+${A.htmlKb - B.htmlKb} KB HTML`, color: '#3b82f6' },
    effects: [
      { text: `Download +${htmlDlDelta}ms`, color: '#3b82f6' },
      { text: 'Lazy content loads later', color: '#ec4899' },
    ],
  },
];

const SSR_IMPACTS = [
  { metric: 'FCP', delta: `+${(fcpDelta / 1000).toFixed(1)}s`, desc: 'Every section waits to appear', color: '#f59e0b' },
  { metric: 'TTI', delta: `+${(ttiDelta / 1000).toFixed(1)}s`, desc: 'Nothing interactive until done', color: '#10b981' },
  { metric: 'JS Bundle', delta: `+${A.jsKb - B.jsKb} KB`, desc: 'Every user downloads more code', color: '#f59e0b' },
  { metric: 'Hydration', delta: `+${hydDelta}ms`, desc: 'One more blocking component', color: '#6366f1' },
];

// ── Lazy mode data ──────────────────────────────────────────────────────────

const LAZY_CHAINS = [
  {
    icon: '🚫',
    trigger: { text: 'Not in server HTML', color: '#64748b' },
    effects: [
      { text: 'Invisible to crawlers', color: '#ef4444' },
      { text: 'SEO risk for important content', color: '#dc2626' },
    ],
  },
  {
    icon: '⏳',
    trigger: { text: `Waits for TTI (${(B.ttiMs / 1000).toFixed(1)}s)`, color: '#6366f1' },
    effects: [
      { text: `Chunk DL: ${Math.round(LAZY_CHUNK_DL)}ms`, color: '#f59e0b' },
      { text: `Data fetch: ${Math.round(LAZY_DATA_DL)}ms`, color: '#ec4899' },
      { text: `Visible at ${(LAZY_VISIBLE / 1000).toFixed(1)}s`, color: '#ef4444' },
    ],
  },
  {
    icon: '📐',
    trigger: { text: 'Late render', color: '#f59e0b' },
    effects: [
      { text: 'Layout shift (CLS)', color: '#f59e0b' },
      { text: 'Content pops in unexpectedly', color: '#64748b' },
    ],
  },
];

const LAZY_IMPACTS = [
  { metric: 'Visible at', delta: `${(LAZY_VISIBLE / 1000).toFixed(1)}s`, desc: `vs ${(B.fcpMs / 1000).toFixed(1)}s if server-rendered`, color: '#ec4899' },
  { metric: 'Render delay', delta: `+${(LAZY_PENALTY / 1000).toFixed(1)}s`, desc: 'Content hidden while page loads', color: '#ef4444' },
  { metric: 'SEO', delta: 'Not indexed', desc: 'Missing from server HTML', color: '#64748b' },
  { metric: 'CLS', delta: 'Layout shift', desc: 'Content pops in after load', color: '#f59e0b' },
];

// ── Component ───────────────────────────────────────────────────────────────

type Mode = 'base' | 'ssr' | 'lazy';

function ChevronRight() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export default function CascadeImpact() {
  const [mode, setMode] = useState<Mode>('base');
  const s = mode === 'ssr' ? 1 : 0;
  const active = mode !== 'base';

  const impacts = mode === 'ssr' ? SSR_IMPACTS : LAZY_IMPACTS;
  const chains = mode === 'ssr' ? SSR_CHAINS : LAZY_CHAINS;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1.5">
              The Cost of &ldquo;Just One More Section&rdquo;
            </h2>
            <p className="text-sm text-slate-500 max-w-xl">
              Your PM wants to add a <strong className="text-slate-700">Loyalty Rewards</strong> section.
              You have two options &mdash; both have trade-offs.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0 mt-1">
            Slow 3G
          </span>
        </div>

        {/* Option cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode(mode === 'ssr' ? 'base' : 'ssr')}
            className={`text-left p-3.5 rounded-xl border-2 transition-all duration-300 ${
              mode === 'ssr'
                ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📦</span>
              <span className={`text-sm font-bold ${mode === 'ssr' ? 'text-indigo-700' : 'text-slate-700'}`}>
                Add to Server HTML (SSR)
              </span>
            </div>
            <p className={`text-[11px] leading-snug ${mode === 'ssr' ? 'text-indigo-500' : 'text-slate-400'}`}>
              Include in initial HTML &mdash; visible early but slows <em>every</em> section
            </p>
          </button>

          <button
            onClick={() => setMode(mode === 'lazy' ? 'base' : 'lazy')}
            className={`text-left p-3.5 rounded-xl border-2 transition-all duration-300 ${
              mode === 'lazy'
                ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">⏳</span>
              <span className={`text-sm font-bold ${mode === 'lazy' ? 'text-amber-700' : 'text-slate-700'}`}>
                Lazy Load (Client-side)
              </span>
            </div>
            <p className={`text-[11px] leading-snug ${mode === 'lazy' ? 'text-amber-600' : 'text-slate-400'}`}>
              Render on client only &mdash; no SSR impact but invisible to search engines
            </p>
          </button>
        </div>
      </div>

      {/* ── Animated waterfall chart ───────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900 px-5 pt-4 pb-5 relative overflow-hidden">
        {/* Subtle background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(90deg, white 1px, transparent 1px), linear-gradient(white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative">
          {/* Time scale ticks */}
          <div className="flex mb-2">
            <div className="w-[100px] flex-shrink-0" />
            <div className="flex-1 relative h-4">
              {Array.from({ length: TICK_COUNT + 1 }).map((_, i) => {
                const pct = (i * 1000 / MAX_T_ROUNDED) * 100;
                return (
                  <span
                    key={i}
                    className="absolute text-[9px] font-mono text-slate-500 -translate-x-1/2"
                    style={{ left: `${pct}%` }}
                  >
                    {i}s
                  </span>
                );
              })}
            </div>
            <div className="w-[80px] flex-shrink-0" />
          </div>

          {/* Resource rows */}
          <div className="space-y-3">
            {ROWS.map((r) => {
              const leftPct = (r.start[s] / MAX_T_ROUNDED) * 100;
              const widthPct = ((r.end[s] - r.start[s]) / MAX_T_ROUNDED) * 100;
              const beforeEndPct = (r.end[0] / MAX_T_ROUNDED) * 100;
              const afterEndPct = (r.end[1] / MAX_T_ROUNDED) * 100;
              const sizeChanged = r.sizeLabel[0] !== r.sizeLabel[1];
              const sizeDelta = sizeChanged
                ? parseInt(r.sizeLabel[1]) - parseInt(r.sizeLabel[0])
                : 0;

              return (
                <div key={r.name} className="flex items-center">
                  <div className="w-[100px] flex-shrink-0 pr-3 text-right flex items-center justify-end gap-1.5">
                    <span className="text-[9px]">{r.icon}</span>
                    <span className="text-[11px] font-semibold text-slate-400">{r.name}</span>
                  </div>

                  <div className="flex-1 relative h-[26px] bg-slate-800/40 rounded">
                    {Array.from({ length: TICK_COUNT }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-slate-700/30"
                        style={{ left: `${((i + 1) * 1000 / MAX_T_ROUNDED) * 100}%` }}
                      />
                    ))}

                    <div
                      className="absolute inset-y-0 rounded transition-all duration-700 ease-in-out"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 0.5)}%`,
                        background: `linear-gradient(135deg, ${r.color}, ${r.gradTo})`,
                        boxShadow: `0 0 12px ${r.color}30`,
                      }}
                    />

                    <div
                      className="absolute inset-y-0 rounded-r transition-all duration-700 ease-in-out"
                      style={{
                        left: `${beforeEndPct}%`,
                        width: mode === 'ssr' && sizeChanged ? `${afterEndPct - beforeEndPct}%` : '0%',
                        background: `repeating-linear-gradient(120deg, ${r.color}bb, ${r.color}bb 3px, ${r.color}44 3px, ${r.color}44 6px)`,
                        opacity: mode === 'ssr' ? 1 : 0,
                      }}
                    />

                    <div
                      className="absolute inset-y-0 flex items-center pl-2.5 pointer-events-none transition-all duration-700 ease-in-out"
                      style={{ left: `${leftPct}%` }}
                    >
                      <span className="text-[9px] font-mono text-white/80 font-semibold whitespace-nowrap drop-shadow-sm">
                        {fmt(r.end[s] - r.start[s])}
                      </span>
                    </div>
                  </div>

                  <div className="w-[80px] flex-shrink-0 pl-3 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {r.sizeLabel[s]}
                    </span>
                    {mode === 'ssr' && sizeDelta > 0 && (
                      <span className="text-[8px] font-bold text-red-400 bg-red-400/10 px-1 py-0.5 rounded">
                        +{sizeDelta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── Lazy row ─────────────────────────────────────────────── */}
            <div
              className="transition-all duration-500 overflow-hidden"
              style={{
                maxHeight: mode === 'lazy' ? '60px' : '0',
                opacity: mode === 'lazy' ? 1 : 0,
                marginTop: mode === 'lazy' ? '16px' : '0',
              }}
            >
              <div className="flex items-center">
                <div className="w-[100px] flex-shrink-0 pr-3 text-right flex items-center justify-end gap-1.5">
                  <span className="text-[9px]">⏳</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-semibold text-amber-400">Loyalty</span>
                    <span className="text-[7px] font-bold text-amber-500/60 uppercase tracking-wider">lazy</span>
                  </div>
                </div>

                <div className="flex-1 relative h-[30px] bg-slate-800/40 rounded">
                  {Array.from({ length: TICK_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-slate-700/30"
                      style={{ left: `${((i + 1) * 1000 / MAX_T_ROUNDED) * 100}%` }}
                    />
                  ))}

                  {/* Waiting period (dashed) — component does nothing until TTI */}
                  <div
                    className="absolute inset-y-1 rounded-l"
                    style={{
                      left: '0%',
                      width: `${(LAZY_START / MAX_T_ROUNDED) * 100}%`,
                      background: 'repeating-linear-gradient(90deg, #475569 0px, #475569 4px, transparent 4px, transparent 8px)',
                      opacity: 0.25,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 text-[7px] font-mono text-slate-500 pointer-events-none"
                    style={{ left: `${(LAZY_START / MAX_T_ROUNDED) * 50}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                  >
                    waiting for JS &amp; hydration...
                  </div>

                  {/* Chunk download segment */}
                  <div
                    className="absolute inset-y-0 rounded-l"
                    style={{
                      left: `${(LAZY_START / MAX_T_ROUNDED) * 100}%`,
                      width: `${(LAZY_CHUNK_DL / MAX_T_ROUNDED) * 100}%`,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      boxShadow: '0 0 8px #f59e0b30',
                    }}
                  />

                  {/* Data fetch segment */}
                  <div
                    className="absolute inset-y-0 rounded-r"
                    style={{
                      left: `${(LAZY_MOUNT_END / MAX_T_ROUNDED) * 100}%`,
                      width: `${((LAZY_DATA_DL + 30) / MAX_T_ROUNDED) * 100}%`,
                      background: 'linear-gradient(135deg, #ec4899, #be185d)',
                      boxShadow: '0 0 8px #ec489930',
                    }}
                  />

                  {/* SSR comparison marker — where the section would be visible if SSR'd */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: `${(B.fcpMs / MAX_T_ROUNDED) * 100}%` }}
                  >
                    <div className="w-px h-full bg-emerald-400/50 border-l border-dashed border-emerald-400/70" />
                    <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-bold text-emerald-400/80">
                      SSR: visible here
                    </div>
                  </div>

                  {/* Duration label */}
                  <div
                    className="absolute inset-y-0 flex items-center pl-1.5 pointer-events-none"
                    style={{ left: `${(LAZY_START / MAX_T_ROUNDED) * 100}%` }}
                  >
                    <span className="text-[8px] font-mono text-white/80 font-semibold whitespace-nowrap">
                      {fmt(LAZY_CHUNK_DL)}
                    </span>
                  </div>
                  <div
                    className="absolute inset-y-0 flex items-center pl-1 pointer-events-none"
                    style={{ left: `${(LAZY_MOUNT_END / MAX_T_ROUNDED) * 100}%` }}
                  >
                    <span className="text-[8px] font-mono text-white/80 font-semibold whitespace-nowrap">
                      {fmt(LAZY_DATA_DL)}
                    </span>
                  </div>
                </div>

                <div className="w-[80px] flex-shrink-0 pl-3 flex items-center">
                  <span className="text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                    +{(LAZY_PENALTY / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Segment legend */}
              <div className="flex gap-4 mt-2" style={{ paddingLeft: '100px' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-slate-500/30" />
                  <span className="text-[8px] text-slate-500">Blocked (waiting)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span className="text-[8px] text-slate-500">JS chunk download</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-pink-500" />
                  <span className="text-[8px] text-slate-500">Data fetch + render</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-px h-2.5 border-l border-dashed border-emerald-400" />
                  <span className="text-[8px] text-emerald-500">Where SSR shows it</span>
                </div>
              </div>
            </div>
          </div>

          {/* Milestone markers */}
          <div className="flex mt-5">
            <div className="w-[100px] flex-shrink-0" />
            <div className="flex-1 relative h-[56px]">
              <div className="absolute top-0 left-0 right-0 h-px bg-slate-700/60" />

              {MILESTONES.map((m) => {
                const pos = (m.time[s] / MAX_T_ROUNDED) * 100;
                const delta = Math.round(m.time[1] - m.time[0]);

                return (
                  <div
                    key={m.label}
                    className="absolute flex flex-col items-center transition-all duration-700 ease-in-out"
                    style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full -mt-1 shadow-lg"
                      style={{ backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}60` }}
                    />
                    <span className="text-[11px] font-bold mt-1" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {(m.time[s] / 1000).toFixed(1)}s
                    </span>
                    <span
                      className="text-[9px] font-bold text-red-400 transition-all duration-300"
                      style={{ opacity: mode === 'ssr' ? 1 : 0, transitionDelay: '400ms' }}
                    >
                      {mode === 'ssr' ? `+${(delta / 1000).toFixed(1)}s` : ' '}
                    </span>
                  </div>
                );
              })}

              {/* Lazy visible milestone */}
              <div
                className="absolute flex flex-col items-center transition-all duration-500"
                style={{
                  left: `${(LAZY_VISIBLE / MAX_T_ROUNDED) * 100}%`,
                  transform: 'translateX(-50%)',
                  opacity: mode === 'lazy' ? 1 : 0,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full -mt-1 shadow-lg"
                  style={{ backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef444460' }}
                />
                <span className="text-[10px] font-bold mt-1 text-red-400 whitespace-nowrap">
                  Loyalty visible
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  {(LAZY_VISIBLE / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
            <div className="w-[80px] flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* ── Impact metrics row ─────────────────────────────────────────── */}
      <div
        className="transition-all duration-500 overflow-hidden"
        style={{ maxHeight: active ? '140px' : '0', opacity: active ? 1 : 0 }}
      >
        <div className="grid grid-cols-4 gap-px bg-slate-200">
          {impacts.map((imp) => (
            <div key={imp.metric} className="bg-white px-4 py-3.5 text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {imp.metric}
              </div>
              <div className={`text-xl font-bold tabular-nums ${mode === 'ssr' ? 'text-red-600' : 'text-amber-600'}`}>
                {imp.delta}
              </div>
              <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{imp.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cascade chain ──────────────────────────────────────────────── */}
      <div
        className="transition-all duration-500 overflow-hidden"
        style={{ maxHeight: active ? '350px' : '0', opacity: active ? 1 : 0 }}
      >
        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3">
            {mode === 'ssr'
              ? 'The Cascade Chain — one section affects everything'
              : 'The Lazy Loading Trade-off — hidden from crawlers'}
          </div>
          <div className="space-y-2.5">
            {chains.map((chain, ci) => (
              <div key={ci} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs">{chain.icon}</span>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white shadow-sm"
                  style={{ backgroundColor: chain.trigger.color }}
                >
                  {chain.trigger.text}
                </span>
                {chain.effects.map((eff, ei) => (
                  <React.Fragment key={ei}>
                    <ChevronRight />
                    <span
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg border"
                      style={{
                        color: eff.color,
                        borderColor: eff.color + '25',
                        backgroundColor: eff.color + '0a',
                      }}
                    >
                      {eff.text}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary insight ────────────────────────────────────────────── */}
      <div
        className="transition-all duration-500 overflow-hidden"
        style={{ maxHeight: active ? '140px' : '0', opacity: active ? 1 : 0 }}
      >
        {mode === 'ssr' ? (
          <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-t border-red-100">
            <p className="text-[13px] text-red-800 leading-relaxed">
              <strong>Every section on the page gets slower</strong> &mdash; not just the new one.
              In SSR, one component&rsquo;s HTML and JS cascade through the entire loading pipeline,
              delaying interactivity and content for ALL existing sections via monolithic hydration.
              <span className="text-red-600 font-bold"> This is the problem RSC solves with streaming and selective hydration.</span>
            </p>
          </div>
        ) : mode === 'lazy' ? (
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-100">
            <p className="text-[13px] text-amber-900 leading-relaxed">
              <strong>Lazy-loaded components are invisible in the server HTML</strong> &mdash; search engines
              may never index them. The section won&rsquo;t render until JavaScript loads, the entire page
              hydrates, then fetches its data client-side &mdash;
              a <strong className="text-red-600">{(LAZY_PENALTY / 1000).toFixed(1)}s delay</strong> compared
              to server-rendering. For important, SEO-critical content, this is not an option.
              <span className="text-amber-700 font-bold"> RSC streams it without these trade-offs.</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

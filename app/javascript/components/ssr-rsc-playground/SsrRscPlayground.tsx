'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_SECTIONS, DEFAULT_PARAMS, LOYALTY_SECTION, NETWORK_PROFILES } from './defaults';
import { getSectionState, simulate } from './model/simulate';
import type { NetworkPreset, SectionSnapshot, SimulationParams } from './types';
import BrowserMockup from './ui/BrowserMockup';
import ImpactAnalysis from './ui/ImpactAnalysis';
import SsrWalkthrough from './ui/SsrWalkthrough';
import CascadeImpact from './ui/CascadeImpact';
import PprWalkthrough from './ui/PprWalkthrough';
import PprStreaming from './ui/PprStreaming';
import HydrationComparison from './ui/HydrationComparison';
import TechnicalDeepDive from './ui/TechnicalDeepDive';

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

function getSsrAnnotation(playheadMs: number, fcpMs: number, ttiMs: number): string {
  if (playheadMs < 1) return 'Page requested — waiting for CDN response...';
  if (playheadMs < fcpMs) return `Blank screen — waiting for HTML + CSS to download (${fmt(fcpMs)})`;
  if (playheadMs < ttiMs) return `Content visible but buttons DON'T WORK — hydrating... (TTI at ${fmt(ttiMs)})`;
  return `Fully interactive at ${fmt(ttiMs)}`;
}

function getRscAnnotation(
  playheadMs: number,
  fcpMs: number,
  sectionTimelines: { sectionId: string; visibleAtMs: number; interactiveAtMs: number }[],
  ttiMs: number,
  sections: { id: string; label: string }[]
): string {
  if (playheadMs < 1) return 'Page requested — waiting for CDN response...';
  if (playheadMs < fcpMs) return 'Loading shell...';
  if (playheadMs >= ttiMs) return `Fully interactive at ${fmt(ttiMs)}`;

  const sectionMap = new Map(sections.map((s) => [s.id, s.label]));
  const streaming = sectionTimelines.find((s) => playheadMs >= s.visibleAtMs - 10 && playheadMs < s.interactiveAtMs);
  const interactive = sectionTimelines.filter((s) => playheadMs >= s.interactiveAtMs);

  if (streaming) {
    const label = sectionMap.get(streaming.sectionId) || streaming.sectionId;
    return `${interactive.length} sections interactive — streaming ${label}...`;
  }
  return `${interactive.length}/${sectionTimelines.length} sections interactive`;
}

export default function SsrRscPlayground() {
  const [networkPreset, setNetworkPreset] = useState<NetworkPreset>('fast4g');
  const [hasAddedSection, setHasAddedSection] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const startOffsetRef = useRef(0);

  const baseSections = BASE_SECTIONS;
  const currentSections = hasAddedSection ? [...baseSections, LOYALTY_SECTION] : baseSections;

  const params: SimulationParams = useMemo(() => ({ networkPreset, sections: currentSections }), [networkPreset, currentSections]);
  const result = useMemo(() => simulate(params), [params]);

  const baseParams: SimulationParams = useMemo(() => ({ networkPreset, sections: baseSections }), [networkPreset, baseSections]);
  const baseResult = useMemo(() => simulate(baseParams), [baseParams]);

  const addedParams: SimulationParams = useMemo(
    () => ({ networkPreset, sections: [...baseSections, LOYALTY_SECTION] }),
    [networkPreset, baseSections]
  );
  const addedResult = useMemo(() => simulate(addedParams), [addedParams]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startedAtRef.current;
    const nextMs = startOffsetRef.current + elapsed;
    const clamped = Math.min(nextMs, result.maxDurationMs);
    setPlayheadMs(clamped);
    if (clamped >= result.maxDurationMs) {
      setIsPlaying(false);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [result.maxDurationMs]);

  useEffect(() => {
    if (isPlaying) {
      startedAtRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return stopAnimation;
  }, [isPlaying, tick, stopAnimation]);

  const handlePlay = useCallback(() => {
    if (playheadMs >= result.maxDurationMs) {
      startOffsetRef.current = 0;
      setPlayheadMs(0);
    } else {
      startOffsetRef.current = playheadMs;
    }
    setIsPlaying(true);
  }, [playheadMs, result.maxDurationMs]);

  const handlePause = useCallback(() => {
    startOffsetRef.current = playheadMs;
    setIsPlaying(false);
  }, [playheadMs]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    startOffsetRef.current = 0;
    setPlayheadMs(0);
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = parseFloat(e.target.value);
    setIsPlaying(false);
    startOffsetRef.current = ms;
    setPlayheadMs(ms);
  }, []);

  const ssrSnapshots: SectionSnapshot[] = currentSections.map((sec) => {
    const tl = result.ssr.sectionTimelines.find((t) => t.sectionId === sec.id);
    return { id: sec.id, label: sec.label, kind: sec.kind, state: tl ? getSectionState(tl, playheadMs) : 'hidden' };
  });

  const rscSnapshots: SectionSnapshot[] = currentSections.map((sec) => {
    const tl = result.rsc.sectionTimelines.find((t) => t.sectionId === sec.id);
    return { id: sec.id, label: sec.label, kind: sec.kind, state: tl ? getSectionState(tl, playheadMs) : 'hidden' };
  });

  const ssrAnnotation = getSsrAnnotation(playheadMs, result.ssr.metrics.fcpMs, result.ssr.metrics.ttiMs);
  const rscAnnotation = getRscAnnotation(
    playheadMs,
    result.rsc.metrics.fcpMs,
    result.rsc.sectionTimelines,
    result.rsc.metrics.ttiMs,
    currentSections
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Restaurant Ordering Page: SSR vs RSC</h1>
          <p className="text-slate-300 max-w-2xl text-sm leading-relaxed">
            Same page. Same content. Fundamentally different architecture. Watch how each approach loads the page — and
            what happens as your product grows.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-5 space-y-8 pb-16">
        {/* SSR Walkthrough - detailed step-by-step */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3">How SSR loads your page — step by step</h2>
          <SsrWalkthrough />
        </div>

        {/* Cascade impact — what happens when you add a section */}
        <CascadeImpact />

        {/* PPR — Partial Prerendering introduction and walkthrough */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3">How PPR loads your page — static shell + streaming resume</h2>
          <PprWalkthrough />
        </div>

        {/* PPR Streaming — wire-level HTML streaming visualization */}
        <PprStreaming />

        {/* Hydration comparison — monolithic SSR vs independent PPR islands */}
        <HydrationComparison />

        {/* Quick side-by-side comparison */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3">Quick comparison: SSR vs RSC</h2>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Network</label>
            <select
              value={networkPreset}
              onChange={(e) => {
                setNetworkPreset(e.target.value as NetworkPreset);
                handleReset();
              }}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white"
            >
              {Object.entries(NETWORK_PROFILES).map(([key, profile]) => (
                <option key={key} value={key}>
                  {profile.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {isPlaying ? '⏸ Pause' : '▶ Watch It Load'}
          </button>
          <button onClick={handleReset} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            ↺ Reset
          </button>

          <div className="flex-1 min-w-[120px]">
            <input
              type="range"
              min={0}
              max={result.maxDurationMs}
              step={1}
              value={playheadMs}
              onChange={handleScrub}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono w-16 text-right">{fmt(playheadMs)}</span>
        </div>

        {/* Side-by-side browser mockups */}
        <div className="grid md:grid-cols-2 gap-5">
          <BrowserMockup title="SSR — Cached HTML from CDN" sections={ssrSnapshots} annotation={ssrAnnotation} accentColor="amber" />
          <BrowserMockup title="RSC — Cached Shell + Streaming" sections={rscSnapshots} annotation={rscAnnotation} accentColor="emerald" />
        </div>

        {/* Compact metrics bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: 'FCP', ssr: result.ssr.metrics.fcpMs, rsc: result.rsc.metrics.fcpMs },
              { label: '1st Interactive', ssr: result.ssr.metrics.firstInteractiveMs, rsc: result.rsc.metrics.firstInteractiveMs },
              { label: 'Fully Interactive', ssr: result.ssr.metrics.ttiMs, rsc: result.rsc.metrics.ttiMs },
              { label: 'HTML', ssr: result.ssr.metrics.htmlKb, rsc: result.rsc.metrics.htmlKb, unit: 'KB' },
              { label: 'JS Bundle', ssr: result.ssr.metrics.jsBundleKb, rsc: result.rsc.metrics.jsBundleKb, unit: 'KB' },
            ].map((m) => {
              const u = m.unit || '';
              const fmtVal = (v: number) => (u ? `${Math.round(v)} ${u}` : fmt(v));
              const delta = m.rsc < m.ssr ? `-${Math.round(((m.ssr - m.rsc) / m.ssr) * 100)}%` : '';
              return (
                <div key={m.label} className="text-center">
                  <div className="text-[10px] text-slate-500 font-medium mb-1">{m.label}</div>
                  <div className="text-[11px] text-amber-700 font-mono">{fmtVal(m.ssr)}</div>
                  <div className="text-[11px] text-emerald-700 font-mono font-bold">{fmtVal(m.rsc)}</div>
                  {delta && <div className="text-[9px] text-emerald-600 font-semibold">{delta}</div>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1 text-[10px] text-amber-700">
              <span className="w-2 h-2 bg-amber-100 border border-amber-300 rounded-sm" /> SSR
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-700">
              <span className="w-2 h-2 bg-emerald-100 border border-emerald-300 rounded-sm" /> RSC
            </span>
          </div>
        </div>

        {/* Impact analysis */}
        <ImpactAnalysis
          baseSSR={baseResult.ssr.metrics}
          baseRSC={baseResult.rsc.metrics}
          addedSSR={addedResult.ssr.metrics}
          addedRSC={addedResult.rsc.metrics}
          hasAddedSection={hasAddedSection}
          onToggle={() => {
            setHasAddedSection(!hasAddedSection);
            handleReset();
          }}
          sectionLabel={LOYALTY_SECTION.label}
        />

        {/* Technical deep dive */}
        <TechnicalDeepDive result={result} playheadMs={playheadMs} />
      </div>
    </div>
  );
}

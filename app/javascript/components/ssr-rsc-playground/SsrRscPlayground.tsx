'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PARAMS } from './defaults';
import { simulate } from './model/simulate';
import type { SimulationParams } from './types';
import ControlsPanel from './ui/ControlsPanel';
import FilmstripSvg from './ui/FilmstripSvg';
import MetricsPanel from './ui/MetricsPanel';
import PlayheadControls from './ui/PlayheadControls';
import RscTimelineSvg from './ui/RscTimelineSvg';
import SsrTimelineSvg from './ui/SsrTimelineSvg';

export default function SsrRscPlayground() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const startOffsetRef = useRef(0);

  const result = useMemo(() => simulate(params), [params]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const elapsed = (performance.now() - startedAtRef.current) * playbackRate;
    const nextMs = startOffsetRef.current + elapsed;
    const clamped = Math.min(nextMs, result.maxDurationMs);
    setPlayheadMs(clamped);

    if (clamped >= result.maxDurationMs) {
      setIsPlaying(false);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [playbackRate, result.maxDurationMs]);

  useEffect(() => {
    if (isPlaying) {
      startedAtRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return stopAnimation;
  }, [isPlaying, tick, stopAnimation]);

  const handlePlay = useCallback(() => {
    if (prefersReducedMotion) {
      setPlayheadMs(result.maxDurationMs);
      return;
    }
    if (playheadMs >= result.maxDurationMs) {
      startOffsetRef.current = 0;
      setPlayheadMs(0);
    } else {
      startOffsetRef.current = playheadMs;
    }
    setIsPlaying(true);
  }, [playheadMs, result.maxDurationMs, prefersReducedMotion]);

  const handlePause = useCallback(() => {
    startOffsetRef.current = playheadMs;
    setIsPlaying(false);
  }, [playheadMs]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    startOffsetRef.current = 0;
    setPlayheadMs(0);
  }, []);

  const handleScrub = useCallback(
    (ms: number) => {
      setIsPlaying(false);
      startOffsetRef.current = ms;
      setPlayheadMs(ms);
    },
    [],
  );

  const handleRateChange = useCallback(
    (rate: number) => {
      if (isPlaying) {
        startOffsetRef.current = playheadMs;
        startedAtRef.current = performance.now();
      }
      setPlaybackRate(rate);
    },
    [isPlaying, playheadMs],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">
            Restaurant Ordering Page: SSR vs RSC
          </h1>
          <p className="text-slate-300 max-w-2xl text-sm sm:text-base leading-relaxed">
            Compare how a restaurant ordering page loads under two architectures.{' '}
            <strong className="text-white">SSR</strong> delivers the full cached page, then lazily
            loads dynamic sections (Cart, Reviews) via <code>@loadable/component</code> after full
            hydration.{' '}
            <strong className="text-white">RSC</strong> serves a cached static shell instantly,
            then streams dynamic sections from the server with selective per-section hydration.
          </p>
          <p className="text-slate-400 text-xs mt-3">
            This is a deterministic simulation based on realistic model constants.{' '}
            <a href="/measure" className="underline hover:text-slate-200 transition">
              See real Lighthouse numbers →
            </a>
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6 space-y-5 pb-16">
        <ControlsPanel params={params} onChange={setParams} />

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <PlayheadControls
            isPlaying={isPlaying}
            playheadMs={playheadMs}
            maxDurationMs={result.maxDurationMs}
            playbackRate={playbackRate}
            onPlay={handlePlay}
            onPause={handlePause}
            onReset={handleReset}
            onScrub={handleScrub}
            onRateChange={handleRateChange}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            SSR Timeline (Cached + @loadable/component)
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Full page served from cache → JS bundle download → blocking hydration →
            lazy chunk downloads + client data fetches for each dynamic section.
          </p>
          <div className="overflow-x-auto">
            <SsrTimelineSvg
              segments={result.ssr.segments}
              milestones={result.ssr.milestones}
              playheadMs={playheadMs}
              maxDurationMs={result.maxDurationMs}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">
            RSC Timeline (Cached Shell + Streaming)
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Cached static shell → tiny JS bundle → dynamic sections stream from server →
            selective hydration per section. No client fetch waterfall.
          </p>
          <div className="overflow-x-auto">
            <RscTimelineSvg
              segments={result.rsc.segments}
              milestones={result.rsc.milestones}
              connectors={result.connectors}
              ssrSegments={result.ssr.segments}
              playheadMs={playheadMs}
              maxDurationMs={result.maxDurationMs}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Page Filmstrip — Restaurant Ordering Page
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Each frame shows 7 page sections: Header, Menu, Cart, Availability, Delivery, Reviews,
            Personalized Picks. Watch how they transition from blank → skeleton → visible → interactive.
          </p>
          <div className="overflow-x-auto">
            <FilmstripSvg
              ssrFrames={result.ssr.filmstripFrames}
              rscFrames={result.rsc.filmstripFrames}
              playheadMs={playheadMs}
              maxDurationMs={result.maxDurationMs}
            />
          </div>
        </div>

        <MetricsPanel
          ssrMetrics={result.ssr.metrics}
          rscMetrics={result.rsc.metrics}
          playheadMs={playheadMs}
        />
      </div>
    </div>
  );
}

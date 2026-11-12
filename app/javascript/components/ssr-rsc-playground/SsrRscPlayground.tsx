'use client';

import React from 'react';
import SsrWalkthrough from './ui/SsrWalkthrough';
import CascadeImpact from './ui/CascadeImpact';
import PprWalkthrough from './ui/PprWalkthrough';
import PprStreaming from './ui/PprStreaming';
import HydrationComparison from './ui/HydrationComparison';

export default function SsrRscPlayground() {
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-8 pb-16">
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
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import type { Metrics } from '../types';

interface ImpactAnalysisProps {
  baseSSR: Metrics;
  baseRSC: Metrics;
  addedSSR: Metrics;
  addedRSC: Metrics;
  hasAddedSection: boolean;
  onToggle: () => void;
  sectionLabel: string;
}

function MetricRow({
  label,
  before,
  after,
  unit,
  worse,
}: {
  label: string;
  before: string;
  after: string;
  unit: string;
  worse: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">{before}{unit}</span>
        <span className="text-slate-300">→</span>
        <span className={worse ? 'text-red-600 font-semibold' : 'text-slate-500'}>{after}{unit}</span>
        {worse && <span className="text-red-500 text-[9px]">▲</span>}
      </div>
    </div>
  );
}

function UnchangedRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 font-medium">{value}{unit}</span>
        <span className="text-emerald-500 text-[9px]">unchanged</span>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

export default function ImpactAnalysis({
  baseSSR,
  baseRSC,
  addedSSR,
  addedRSC,
  hasAddedSection,
  onToggle,
  sectionLabel,
}: ImpactAnalysisProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-base font-bold text-slate-800 mb-1">What happens when your product grows?</h2>
      <p className="text-sm text-slate-500 mb-4">
        Your PM wants to add a <strong>{sectionLabel}</strong> section. Watch what happens to performance.
      </p>

      <button
        onClick={onToggle}
        className={`mb-5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          hasAddedSection
            ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
        }`}
      >
        {hasAddedSection ? `− Remove ${sectionLabel}` : `+ Add ${sectionLabel} Section`}
      </button>

      {hasAddedSection && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-lg border border-red-200 bg-red-50/30 p-4">
            <div className="text-xs font-bold text-red-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-red-100 rounded flex items-center justify-center text-[10px]">!</span>
              SSR: Cascading Impact
            </div>
            <MetricRow label="CSS in <head>" before={`${Math.round(baseSSR.cssInHeadKb)}`} after={`${Math.round(addedSSR.cssInHeadKb)}`} unit=" KB" worse />
            <MetricRow label="FCP" before={fmt(baseSSR.fcpMs)} after={fmt(addedSSR.fcpMs)} unit="" worse />
            <MetricRow label="JS Bundle" before={`${Math.round(baseSSR.jsBundleKb)}`} after={`${Math.round(addedSSR.jsBundleKb)}`} unit=" KB" worse />
            <MetricRow label="TTI" before={fmt(baseSSR.ttiMs)} after={fmt(addedSSR.ttiMs)} unit="" worse />
            <div className="mt-3 text-[10px] text-red-600 font-medium bg-red-100/60 rounded px-2 py-1.5">
              Every section on the page loads slower — Header, Menu, Cart, Reviews — all delayed.
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="text-xs font-bold text-emerald-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-emerald-100 rounded flex items-center justify-center text-[10px]">✓</span>
              RSC: Isolated Impact
            </div>
            <UnchangedRow label="Shell CSS" value={`${Math.round(baseRSC.cssInHeadKb)}`} unit=" KB" />
            <UnchangedRow label="FCP" value={fmt(baseRSC.fcpMs)} unit="" />
            <UnchangedRow label="Client JS" value={`${Math.round(baseRSC.jsBundleKb)}`} unit=" KB" />
            <UnchangedRow label="TTI" value={fmt(baseRSC.ttiMs)} unit="" />
            <div className="mt-3 text-[10px] text-emerald-600 font-medium bg-emerald-100/60 rounded px-2 py-1.5">
              Header, Menu, Cart, Reviews — all completely unaffected. Only the new boundary streams in.
            </div>
          </div>
        </div>
      )}

      {!hasAddedSection && (
        <div className="text-center text-sm text-slate-400 py-6 border border-dashed border-slate-200 rounded-lg">
          Click the button above to see how adding a section impacts each architecture differently.
        </div>
      )}
    </div>
  );
}

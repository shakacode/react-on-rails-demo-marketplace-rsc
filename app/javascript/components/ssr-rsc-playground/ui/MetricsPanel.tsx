'use client';

import React from 'react';
import type { Metrics } from '../types';

interface MetricsPanelProps {
  ssrMetrics: Metrics;
  rscMetrics: Metrics;
  playheadMs: number;
}

interface MetricCardProps {
  label: string;
  unit: string;
  ssrValue: number;
  rscValue: number;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
  activeAtMs?: number;
  playheadMs: number;
}

function MetricCard({
  label,
  unit,
  ssrValue,
  rscValue,
  format,
  lowerIsBetter = true,
  activeAtMs,
  playheadMs,
}: MetricCardProps) {
  const delta = ssrValue - rscValue;
  const pctImprovement = ssrValue !== 0 ? (delta / ssrValue) * 100 : 0;
  const isImproved = lowerIsBetter ? delta > 0 : delta < 0;
  const isActive = activeAtMs !== undefined && playheadMs >= activeAtMs;

  return (
    <div
      className={`rounded-lg border p-3 transition-all duration-300 ${
        isActive
          ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-xs font-medium text-slate-500 mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">SSR</div>
          <div className="text-sm font-semibold text-slate-900 tabular-nums">
            {format(ssrValue)}
            <span className="text-slate-400 font-normal ml-0.5">{unit}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">RSC</div>
          <div className="text-sm font-semibold text-slate-900 tabular-nums">
            {format(rscValue)}
            <span className="text-slate-400 font-normal ml-0.5">{unit}</span>
          </div>
        </div>
      </div>
      {Math.abs(pctImprovement) > 0.5 && (
        <div
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block ${
            isImproved
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {isImproved ? '↓' : '↑'} {Math.abs(Math.round(pctImprovement))}%
        </div>
      )}
    </div>
  );
}

const fmtMs = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtKb = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function MetricsPanel({ ssrMetrics, rscMetrics, playheadMs }: MetricsPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Performance Metrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="First Contentful Paint"
          unit="ms"
          ssrValue={ssrMetrics.fcpMs}
          rscValue={rscMetrics.fcpMs}
          format={fmtMs}
          activeAtMs={Math.min(ssrMetrics.fcpMs, rscMetrics.fcpMs)}
          playheadMs={playheadMs}
        />
        <MetricCard
          label="Page with Fallbacks"
          unit="ms"
          ssrValue={ssrMetrics.pageWithFallbacksMs}
          rscValue={rscMetrics.pageWithFallbacksMs}
          format={fmtMs}
          activeAtMs={Math.min(ssrMetrics.pageWithFallbacksMs, rscMetrics.pageWithFallbacksMs)}
          playheadMs={playheadMs}
        />
        <MetricCard
          label="First Interactive"
          unit="ms"
          ssrValue={ssrMetrics.firstInteractiveMs}
          rscValue={rscMetrics.firstInteractiveMs}
          format={fmtMs}
          activeAtMs={Math.min(ssrMetrics.firstInteractiveMs, rscMetrics.firstInteractiveMs)}
          playheadMs={playheadMs}
        />
        <MetricCard
          label="Fully Loaded"
          unit="ms"
          ssrValue={ssrMetrics.fullyLoadedMs}
          rscValue={rscMetrics.fullyLoadedMs}
          format={fmtMs}
          activeAtMs={Math.min(ssrMetrics.fullyLoadedMs, rscMetrics.fullyLoadedMs)}
          playheadMs={playheadMs}
        />
        <MetricCard
          label="HTML Size"
          unit="KB"
          ssrValue={ssrMetrics.htmlKb}
          rscValue={rscMetrics.htmlKb}
          format={fmtKb}
          activeAtMs={0}
          playheadMs={playheadMs}
        />
        <MetricCard
          label="JS Bundle"
          unit="KB"
          ssrValue={ssrMetrics.jsKb}
          rscValue={rscMetrics.jsKb}
          format={fmtKb}
          activeAtMs={0}
          playheadMs={playheadMs}
        />
      </div>
    </div>
  );
}

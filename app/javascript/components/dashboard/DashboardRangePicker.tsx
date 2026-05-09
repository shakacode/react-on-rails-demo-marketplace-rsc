// No 'use client' — pure server component. Each pill is an <a> link that
// changes ?range=... and re-runs the controller. Zero client JS.

import React from 'react';

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
] as const;

interface Props {
  range: string;
}

export function DashboardRangePicker({ range }: Props) {
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mr-1">Range:</span>
      {RANGES.map((r) => {
        const active = r.value === range;
        return (
          <a
            key={r.value}
            href={`?range=${r.value}`}
            aria-current={active ? 'page' : undefined}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            {r.label}
          </a>
        );
      })}
    </div>
  );
}

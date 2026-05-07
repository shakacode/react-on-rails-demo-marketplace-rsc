// Pure presentational — works in both server and client trees because it
// has no 'use client' and no interactive state. Heavy lib (intl-messageformat)
// is in `formatCurrency.ts`, also no 'use client'.
import React from 'react';
import { buildPriceLadder } from '../../utils/formatCurrency';

interface Props {
  priceUsd: number;
  highlight?: string;
}

export function PriceLadder({ priceUsd, highlight = 'USD' }: Props) {
  const ladder = buildPriceLadder(priceUsd);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
      {ladder.map(({ code, label }) => (
        <div
          key={code}
          className={
            'rounded-md border px-2 py-1.5 ' +
            (code === highlight
              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-semibold'
              : 'border-slate-200 bg-white text-slate-700')
          }
        >
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{code}</div>
          <div className="font-mono">{label}</div>
        </div>
      ))}
    </div>
  );
}

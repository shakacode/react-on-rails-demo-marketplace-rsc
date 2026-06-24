'use client';

import React from 'react';
import { NETWORK_PROFILES } from '../defaults';
import type { NetworkPreset, SimulationParams } from '../types';

interface ControlsPanelProps {
  params: SimulationParams;
  onChange: (params: SimulationParams) => void;
}

export default function ControlsPanel({ params, onChange }: ControlsPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-sm font-medium text-slate-700">Menu Items</label>
            <span className="text-sm font-semibold text-indigo-600 tabular-nums">{params.menuItems}</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={params.menuItems}
            onChange={(e) => onChange({ ...params, menuItems: Number(e.target.value) })}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            aria-label={`Menu items: ${params.menuItems}`}
          />
          <p className="text-xs text-slate-400 mt-1">
            Affects HTML payload size, JS bundle, and hydration cost
          </p>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-sm font-medium text-slate-700">Network</label>
            <span className="text-sm font-semibold text-indigo-600">
              {NETWORK_PROFILES[params.networkPreset].label}
            </span>
          </div>
          <select
            value={params.networkPreset}
            onChange={(e) =>
              onChange({ ...params, networkPreset: e.target.value as NetworkPreset })
            }
            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            aria-label="Network speed"
          >
            {(Object.keys(NETWORK_PROFILES) as NetworkPreset[]).map((key) => (
              <option key={key} value={key}>
                {NETWORK_PROFILES[key].label} ({NETWORK_PROFILES[key].rttMs}ms RTT)
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Simulates download speed and round-trip latency
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500">
          <div>
            <span className="font-medium text-slate-600">SSR approach:</span> Full page cached via
            Rails fragment caching. Dynamic sections (Cart, Reviews, etc.) lazy-loaded via{' '}
            <code className="text-indigo-600">@loadable/component</code> after full hydration.
          </div>
          <div>
            <span className="font-medium text-slate-600">RSC approach:</span> Static shell cached
            and served instantly. Dynamic sections streamed from server and selectively hydrated
            per-section.
          </div>
        </div>
      </div>
    </div>
  );
}

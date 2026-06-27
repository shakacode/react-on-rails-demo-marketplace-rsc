'use client';

import React from 'react';
import type { SectionSnapshot, SectionVisualState } from '../types';

interface BrowserMockupProps {
  title: string;
  sections: SectionSnapshot[];
  annotation: string;
  accentColor: 'amber' | 'emerald';
}

const SECTION_DETAILS: Record<string, { icon: string; detail: string }> = {
  header: { icon: 'H', detail: "Bella's Pizza  ★★★★☆" },
  menu: { icon: 'M', detail: '12 items · $8–$22' },
  cart: { icon: 'C', detail: '2 items · $24.99' },
  delivery: { icon: 'D', detail: 'Est. 25–35 min' },
  reviews: { icon: 'R', detail: '★★★★☆ · 142 reviews' },
  recommendations: { icon: 'F', detail: '4 picks for you' },
  loyalty: { icon: 'L', detail: '230 pts · $5 reward' },
};

function SectionRow({ section }: { section: SectionSnapshot }) {
  const details = SECTION_DETAILS[section.id] || { icon: section.label[0], detail: '' };

  if (section.state === 'hidden') {
    return <div className="h-[38px]" />;
  }

  if (section.state === 'skeleton') {
    return (
      <div className="h-[38px] bg-slate-50 rounded-lg border border-slate-200 px-3 flex items-center gap-2.5 animate-pulse">
        <div className="w-6 h-6 bg-slate-200 rounded" />
        <div className="flex-1 space-y-1">
          <div className="h-2 bg-slate-200 rounded w-1/3" />
          <div className="h-1.5 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const interactive = section.state === 'interactive';

  return (
    <div
      className={`h-[38px] rounded-lg border px-3 flex items-center gap-2.5 transition-all duration-200 ${
        interactive ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'
      }`}
    >
      <div
        className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
          interactive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {details.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-slate-700 leading-tight truncate">{section.label}</div>
        <div className="text-[8px] text-slate-400 leading-tight truncate">{details.detail}</div>
      </div>
      {interactive && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />}
      {section.state === 'visible' && (
        <div className="text-[7px] text-slate-400 flex-shrink-0 whitespace-nowrap">not interactive</div>
      )}
    </div>
  );
}

export default function BrowserMockup({ title, sections, annotation, accentColor }: BrowserMockupProps) {
  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : 'border-amber-200';
  const annotBg = accentColor === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-xl overflow-hidden shadow-lg border ${borderColor}`}>
      <div className="h-8 bg-gradient-to-b from-slate-600 to-slate-700 flex items-center px-3 gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        <div className="flex-1 mx-6">
          <div className="bg-slate-800/60 rounded px-2 py-0.5 text-[9px] text-slate-400 text-center truncate">
            bellas-pizza.com/order
          </div>
        </div>
      </div>

      <div className="bg-slate-50 px-2 py-1.5">
        <div className="text-[10px] font-semibold text-slate-600">{title}</div>
      </div>

      <div className="bg-white p-2 space-y-1.5 min-h-[300px]">
        {sections.map((sec) => (
          <SectionRow key={sec.id} section={sec} />
        ))}
      </div>

      <div className={`px-3 py-2 text-[11px] font-medium ${annotBg}`}>{annotation}</div>
    </div>
  );
}

// 'use client' counterpart — same render, libs ship to browser.
'use client';

import React from 'react';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';
import { HoursEntry, DetailRestaurant } from './types';

interface Props {
  neighborhood: string;
  faq: string;
  hours: HoursEntry[];
  restaurant: DetailRestaurant;
}

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function todayIndex(): number {
  return new Date().getUTCDay();
}

function HoursCard({ hours }: { hours: HoursEntry[] }) {
  const order = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = order[todayIndex()];
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6v4l3 1.5" strokeLinecap="round" />
        </svg>
        Hours
      </h3>
      <table className="text-sm w-full">
        <tbody>
          {hours.map((h) => {
            const isToday = h.day === todayName;
            return (
              <tr key={h.day} className={'border-b border-slate-100 last:border-0 ' + (isToday ? 'bg-amber-50/50' : '')}>
                <td className={'py-1.5 pr-2 ' + (isToday ? 'font-bold text-amber-900' : 'font-medium text-slate-700')}>
                  {DAY_SHORT[h.day] ?? h.day}
                  {isToday && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-700">today</span>}
                </td>
                <td className={'py-1.5 text-right tabular-nums ' + (isToday ? 'font-semibold text-amber-900' : 'text-slate-600')}>
                  {h.closed ? <span className="text-slate-400">Closed</span> : `${h.open} – ${h.close}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </aside>
  );
}

function ReservationCard({ restaurant }: { restaurant: DetailRestaurant }) {
  return (
    <aside className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
      <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="14" height="12" rx="2" />
          <path d="M3 9h14M7 3v4M13 3v4" strokeLinecap="round" />
        </svg>
        Reserve
      </h3>
      <p className="text-sm text-amber-900/80 mb-4">
        Walk-ins welcome at the bar; tasting menu requires 48 hours notice.
      </p>
      <div className="space-y-2">
        <a href={`tel:${(restaurant.phone || '').replace(/\D/g, '')}`} className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors">
          Call {restaurant.phone}
        </a>
        <a href={restaurant.website || '#'} className="block w-full text-center bg-white hover:bg-amber-50 text-amber-800 font-semibold rounded-lg px-4 py-2.5 border border-amber-300 transition-colors">
          Book online
        </a>
      </div>
    </aside>
  );
}

export function SidebarSection({ neighborhood, faq, hours, restaurant }: Props) {
  const neighborhoodHtml = renderSanitizedMarkdown(neighborhood);
  const faqHtml = renderSanitizedMarkdown(faq);
  return (
    <section className="container mx-auto px-4 mb-14">
      <div className="border-b border-slate-200 pb-3 mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">Visit Us</p>
        <h2 className="text-3xl font-bold text-slate-900">Find your way here</h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <article
          className="prose prose-slate max-w-none lg:col-span-2 prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-0 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-table:text-sm"
          dangerouslySetInnerHTML={{ __html: neighborhoodHtml }}
        />
        <div className="space-y-4">
          <HoursCard hours={hours} />
          <ReservationCard restaurant={restaurant} />
        </div>
      </div>

      <div
        className="prose prose-slate max-w-3xl mx-auto prose-headings:font-bold prose-h2:text-2xl prose-h2:text-center prose-h2:mt-0 prose-h2:mb-6 prose-strong:text-slate-900 prose-strong:block prose-strong:mt-4 prose-strong:mb-1"
        dangerouslySetInnerHTML={{ __html: faqHtml }}
      />
    </section>
  );
}

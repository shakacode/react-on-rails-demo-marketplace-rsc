// No 'use client' — purely presentational, used in both RSC and SSR/Client trees.
import React from 'react';
import { DetailRestaurant, RestaurantStats, HoursEntry } from './types';

interface Props {
  restaurant: DetailRestaurant;
  stats: RestaurantStats;
  hours: HoursEntry[];
  variant: 'ssr' | 'client' | 'rsc';
}

const VARIANT_BANNER: Record<Props['variant'], { color: string; label: string }> = {
  ssr: {
    color: 'bg-blue-50 border-blue-200 text-blue-800',
    label: "V1: Full SSR — every section's markdown rendered server-side, then re-rendered on the client during hydration. Ships marked + highlight.js + sanitize-html + intl-messageformat (~400 KB).",
  },
  client: {
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    label: 'V2: Client variant — basic shell SSRed, the heavy markdown sections render after a client-side fetch + hydration. Same heavy libraries ship to the browser.',
  },
  rsc: {
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    label: 'V3: RSC streaming — markdown, sanitization, currency formatting all run on the server. Browser receives only HTML; no markdown libs ship to the client.',
  },
};

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function todayLabel(hours: HoursEntry[]): string {
  // Use UTC weekday so server (Node, often UTC) and browser hydration match —
  // avoids React hydration mismatch on the SSR variant.
  const idx = new Date().getUTCDay(); // 0 = Sunday
  const order = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = hours.find((h) => h.day === order[idx]);
  if (!today) return '';
  return today.closed ? 'Closed today' : `Open ${today.open}–${today.close}`;
}

function priceTier(stats: RestaurantStats): string {
  // Map "tables" to a $-tier loosely (deterministic per restaurant, no extra props needed).
  const t = stats.tables;
  if (t < 22) return '$$';
  if (t < 30) return '$$$';
  return '$$$$';
}

const Star = ({ filled }: { filled: number }) => (
  <span aria-hidden="true" className="inline-flex">
    <svg width="16" height="16" viewBox="0 0 20 20" fill={filled >= 100 ? '#fbbf24' : '#fbbf24'} fillOpacity={filled / 100}>
      <path stroke="#fbbf24" strokeWidth="1" d="M10 1.5l2.7 5.5 6 .9-4.4 4.3 1 6-5.3-2.8-5.4 2.8 1-6L1.3 7.9l6-.9z" />
    </svg>
  </span>
);

function StarRow({ value }: { value: number }) {
  // value is 0..5 with one decimal
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = Math.max(0, Math.min(100, (value - (i - 1)) * 100));
    stars.push(<Star key={i} filled={filled} />);
  }
  return <span className="inline-flex gap-[2px]">{stars}</span>;
}

export function RestaurantHeader({ restaurant, stats, hours, variant }: Props) {
  const banner = VARIANT_BANNER[variant];
  const heroImage = restaurant.image_url
    ? restaurant.image_url.replace(/\d+\/\d+$/, '1600/640')
    : `https://picsum.photos/seed/restaurant-hero-${restaurant.id}/1600/640`;

  return (
    <>
      {/* Variant explainer pill (kept compact above the hero) */}
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-3">
          <p className={'text-xs sm:text-sm rounded-md px-3 py-1.5 border ' + banner.color}>
            {banner.label}
          </p>
        </div>
      </div>

      {/* Hero with image + overlay */}
      <section
        className="relative bg-slate-900 text-white"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.85) 100%), url("${heroImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-4 pt-12 sm:pt-20 pb-8">
          <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-amber-300 font-semibold mb-3">
            {restaurant.cuisine_type} · {restaurant.city}, {restaurant.state}
          </p>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            {restaurant.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <StarRow value={restaurant.average_rating} />
              <span className="font-semibold">{restaurant.average_rating.toFixed(1)}</span>
              <span className="text-slate-300">({restaurant.review_count.toLocaleString()} reviews)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {todayLabel(hours)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 8h12M8 4v12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {restaurant.address}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="font-semibold tracking-wider">{priceTier(stats)}</span>
              <span className="text-slate-400">·</span>
              <span>{stats.menu_items_count} dishes</span>
              <span className="text-slate-400">·</span>
              <span>{stats.years_open} yrs open</span>
            </span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={`tel:${(restaurant.phone || '').replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded-full px-5 py-2.5 transition-colors shadow-lg shadow-amber-500/30"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 3a2 2 0 0 0-2 2v1c0 6 5 11 11 11h1a2 2 0 0 0 2-2v-2.5a1 1 0 0 0-.7-1l-3-1a1 1 0 0 0-1 .3l-1.4 1.4a10 10 0 0 1-4-4l1.4-1.4a1 1 0 0 0 .3-1l-1-3A1 1 0 0 0 6.5 3H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              Reserve a table
            </a>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full px-5 py-2.5 backdrop-blur-sm border border-white/20 transition-colors"
            >
              See the menu
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* At-a-glance KPI bar — sits below hero, like a card overlap */}
      <div className="bg-slate-50/0 -mt-8 mb-10 relative z-10">
        <div className="container mx-auto px-4">
          <div className="bg-white shadow-lg shadow-slate-900/5 border border-slate-200 rounded-2xl px-2 sm:px-4 py-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200">
            <KpiCell icon="award" label="Awards" value={`${stats.years_open}+ yrs`} sub="of recognition" />
            <KpiCell icon="users" label="Team" value={`${stats.staff_count}`} sub={`across ${stats.tables} tables`} />
            <KpiCell icon="leaf" label="Menu refresh" value={`${stats.seasonal_menu_changes_per_year}× / yr`} sub="seasonal" />
            <KpiCell icon="party" label="Avg party" value={`${stats.avg_party_size.toFixed(1)}`} sub="people / table" />
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCell({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="px-3 sm:px-5 py-2 flex items-center gap-3">
      <span className="hidden sm:inline-flex w-9 h-9 rounded-lg bg-amber-50 text-amber-700 items-center justify-center shrink-0">
        <KpiIcon name={icon} />
      </span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <div className="text-base font-bold text-slate-900 leading-tight">{value}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

function KpiIcon({ name }: { name: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true } as const;
  switch (name) {
    case 'award':
      return (
        <svg {...props}>
          <circle cx="10" cy="8" r="5" />
          <path d="M6 13l-2 5 4-2 2 2 2-2 4 2-2-5" strokeLinejoin="round" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="3" />
          <circle cx="14" cy="9" r="2.5" />
          <path d="M2 17c.5-3 3-5 5-5s4.5 2 5 5M11 17c.4-2 2-3.5 3.5-3.5S17.5 15 18 17" strokeLinecap="round" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...props}>
          <path d="M5 14c0-7 5-10 12-10-1 7-5 11-12 12z" strokeLinejoin="round" />
          <path d="M5 16l5-5" strokeLinecap="round" />
        </svg>
      );
    case 'party':
      return (
        <svg {...props}>
          <path d="M3 16l4-10 4 6-3 4z" strokeLinejoin="round" />
          <circle cx="14" cy="6" r="1.5" />
          <path d="M16 11l1 2M12 4l-1-2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

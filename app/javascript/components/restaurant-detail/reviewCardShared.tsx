// Plain shared module — no 'use client', usable from both trees (same
// convention as chunkPairs.ts). Presentational bits the server and client
// review cards render identically; keeping one copy means the avatar hash and
// star markup can never drift between the ForServer and client twins.
import React from 'react';
import { Review } from './types';

const AVATAR_PALETTE = [
  ['bg-rose-100',    'text-rose-700'],
  ['bg-amber-100',   'text-amber-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-sky-100',     'text-sky-700'],
  ['bg-fuchsia-100', 'text-fuchsia-700'],
  ['bg-orange-100',  'text-orange-700'],
];

export function avatarFor(reviewer: string) {
  const initial = reviewer.trim().charAt(0).toUpperCase();
  let h = 0;
  for (let i = 0; i < reviewer.length; i++) h = (h + reviewer.charCodeAt(i)) % AVATAR_PALETTE.length;
  return { initial, palette: AVATAR_PALETTE[h] };
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${value} of 5`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export function RatingDistribution({ reviews, averageRating, reviewCount }: { reviews: Review[]; averageRating: number; reviewCount: number }) {
  const buckets = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }));
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-start mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center sm:text-left">
        <div className="text-5xl font-extrabold text-slate-900 leading-none">{averageRating.toFixed(1)}</div>
        <Stars value={Math.round(averageRating)} />
        <div className="text-xs text-slate-500 mt-1">{reviewCount.toLocaleString('en-US')} total reviews</div>
      </div>
      <div className="space-y-1.5">
        {buckets.map(({ rating, count }) => (
          <div key={rating} className="flex items-center gap-3 text-xs">
            <span className="w-6 text-slate-700 font-semibold shrink-0">{rating}★</span>
            <span className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <span className="block h-full bg-amber-400 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="w-8 text-right text-slate-500 tabular-nums shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

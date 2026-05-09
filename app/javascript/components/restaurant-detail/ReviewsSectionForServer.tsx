// Server-only — renders 40 review threads with markdown bodies + code blocks
// using marked/highlight.js/sanitize-html on the server.
import React from 'react';
import { Review } from './types';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';

interface Props {
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
}

const AVATAR_PALETTE = [
  ['bg-rose-100',    'text-rose-700'],
  ['bg-amber-100',   'text-amber-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-sky-100',     'text-sky-700'],
  ['bg-fuchsia-100', 'text-fuchsia-700'],
  ['bg-orange-100',  'text-orange-700'],
];

function avatarFor(reviewer: string) {
  const initial = reviewer.trim().charAt(0).toUpperCase();
  let h = 0;
  for (let i = 0; i < reviewer.length; i++) h = (h + reviewer.charCodeAt(i)) % AVATAR_PALETTE.length;
  return { initial, palette: AVATAR_PALETTE[h] };
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${value} of 5`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function RatingDistribution({ reviews, averageRating, reviewCount }: { reviews: Review[]; averageRating: number; reviewCount: number }) {
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
        <div className="text-xs text-slate-500 mt-1">{reviewCount.toLocaleString()} total reviews</div>
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

function ReviewCard({ review }: { review: Review }) {
  const html = renderSanitizedMarkdown(review.body);
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
  });
  const av = avatarFor(review.reviewer);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <header className="flex items-start gap-4 mb-3">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${av.palette[0]} ${av.palette[1]} shrink-0`}>{av.initial}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h4 className="text-base font-bold text-slate-900">{review.title}</h4>
            <span className="text-xs text-slate-400">{date}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <Stars value={review.rating} />
            <span>· {review.reviewer}</span>
            {review.verified && <span className="inline-flex items-center gap-1 text-emerald-700"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>verified</span>}
          </p>
        </div>
      </header>
      <div className="prose prose-sm prose-slate max-w-none prose-p:my-2 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none" dangerouslySetInnerHTML={{ __html: html }} />
      <footer className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>{review.helpful_count} found this helpful</span>
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 7l5-4 5 4v6H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          Helpful
        </span>
      </footer>
    </article>
  );
}

export function ReviewsSection({ reviews, averageRating, reviewCount }: Props) {
  return (
    <section className="container mx-auto px-4 mb-14">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">From Our Guests</p>
          <h2 className="text-3xl font-bold text-slate-900">Reviews</h2>
        </div>
        <p className="text-sm text-slate-500">Most recent {reviews.length} of {reviewCount.toLocaleString()}</p>
      </div>
      <RatingDistribution reviews={reviews} averageRating={averageRating} reviewCount={reviewCount} />
      <div className="grid md:grid-cols-2 gap-4">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </section>
  );
}

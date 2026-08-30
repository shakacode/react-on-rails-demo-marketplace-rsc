// Server-only — renders 40 review threads with markdown bodies + code blocks
// using marked/highlight.js/sanitize-html on the server. Card + distribution
// markup lives in ReviewCardForServer (shared with the virtualized variant).
import React from 'react';
import { Review } from './types';
import { ReviewCard } from './ReviewCardForServer';
import { RatingDistribution } from './reviewCardShared';

interface Props {
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
}

export function ReviewsSection({ reviews, averageRating, reviewCount }: Props) {
  return (
    <section className="container mx-auto px-4 mb-14">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">From Our Guests</p>
          <h2 className="text-3xl font-bold text-slate-900">Reviews</h2>
        </div>
        <p className="text-sm text-slate-500">Most recent {reviews.length} of {reviewCount.toLocaleString('en-US')}</p>
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

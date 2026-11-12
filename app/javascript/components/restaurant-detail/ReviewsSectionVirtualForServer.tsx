// Server-only — Shape B of issue #184: the virtualized twin of
// ReviewsSectionForServer. The server renders ALL review cards (markdown +
// highlight.js + sanitize-html stay server-side) and passes the resulting
// element rows across the RSC boundary — elements are serializable, functions
// are not, so itemContent lives inside the 'use client' wrapper. The client
// mounts only the visible window; the RSC payload still carries every row.
import React from 'react';
import { Review, VirtualizationConfig } from './types';
import VirtualElementList from '../shared/VirtualElementListForServer';
import { ReviewCard } from './ReviewCardForServer';
import { RatingDistribution } from './reviewCardShared';
import { chunkPairs } from './chunkPairs';

interface Props {
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
  virtualization: VirtualizationConfig;
}

export function ReviewsSectionVirtual({ reviews, averageRating, reviewCount, virtualization }: Props) {
  const rows = chunkPairs(reviews);
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
      <VirtualElementList
        initialRows={virtualization.initial_rows}
        keys={rows.map((pair) => pair[0].id)}
        items={rows.map((pair) => (
          // pb-4 (padding) for row spacing — margins escape Virtuoso's measurement.
          <div key={pair[0].id} className="grid md:grid-cols-2 gap-4 pb-4">
            {pair.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        ))}
      />
    </section>
  );
}

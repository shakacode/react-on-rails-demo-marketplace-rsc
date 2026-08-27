// 'use client' — Shape A of issue #184: the virtualized twin of
// ReviewsSection. Same sort/filter interactivity and the same client-side
// markdown rendering as the ssr baseline; only the card list is virtualized
// (rows of two cards through the shared Virtuoso wrapper). Offscreen cards are
// never rendered, so the markdown work happens per-row on mount, not up front.
'use client';

import React, { useMemo, useState } from 'react';
import { Review, VirtualizationConfig } from './types';
import VirtualElementList from '../shared/VirtualElementList';
import { RatingDistribution, ReviewCard } from './ReviewsSection';
import { chunkPairs } from './chunkPairs';

type SortKey = 'newest' | 'rating' | 'helpful';

interface Props {
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
  virtualization: VirtualizationConfig;
}

export function ReviewsSectionVirtual({ reviews, averageRating, reviewCount, virtualization }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [minRating, setMinRating] = useState(0);

  const visible = useMemo(() => {
    const filtered = reviews.filter((r) => r.rating >= minRating);
    const sorted = [...filtered];
    if (sortKey === 'newest') sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sortKey === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else if (sortKey === 'helpful') sorted.sort((a, b) => b.helpful_count - a.helpful_count);
    return sorted;
  }, [reviews, sortKey, minRating]);

  const rows = useMemo(() => chunkPairs(visible), [visible]);

  return (
    <section className="container mx-auto px-4 mb-14">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">From Our Guests</p>
          <h2 className="text-3xl font-bold text-slate-900">Reviews</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-600">Sort:
            <select className="ml-2 rounded border border-slate-300 px-2 py-1" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="newest">Newest</option>
              <option value="rating">Rating</option>
              <option value="helpful">Most helpful</option>
            </select>
          </label>
          <label className="text-slate-600">Min rating:
            <select className="ml-2 rounded border border-slate-300 px-2 py-1" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Any</option>
              <option value={3}>3★</option>
              <option value={4}>4★</option>
              <option value={5}>5★</option>
            </select>
          </label>
        </div>
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

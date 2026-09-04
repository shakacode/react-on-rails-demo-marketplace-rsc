// No 'use client' — this is a server component in RSC.

import React from 'react';
import { RatingDistribution } from '../../types/product';
import { StarRating } from './ProductInfo';

interface Props {
  distribution: RatingDistribution[];
  averageRating: number;
  totalReviews: number;
}

function RatingBar({ stars, percentage, count }: RatingDistribution) {
  const barColor =
    stars >= 4 ? 'bg-green-500' :
    stars === 3 ? 'bg-yellow-400' :
    'bg-red-400';

  return (
    <div className="flex items-center gap-3 group">
      <div className="flex items-center gap-1 w-12 justify-end flex-shrink-0">
        <span className="text-sm font-medium text-gray-600 tabular-nums">{stars}</span>
        <span className="text-sm text-amber-400">★</span>
      </div>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.max(percentage, 1)}%` }}
        />
      </div>
      <div className="w-24 text-right flex-shrink-0">
        <span className="text-sm text-gray-500 tabular-nums">
          {percentage.toFixed(0)}%
          <span className="text-gray-400 ml-1">({count.toLocaleString('en-US')})</span>
        </span>
      </div>
    </div>
  );
}

export function ReviewDistributionChart({ distribution, averageRating, totalReviews }: Props) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6">
      <div className="flex items-start gap-8">
        {/* Left: Overall rating */}
        <div className="text-center flex-shrink-0">
          <div className="text-5xl font-bold text-gray-900 tabular-nums">{averageRating.toFixed(1)}</div>
          <div className="flex items-center justify-center mt-2">
            <StarRating rating={averageRating} />
          </div>
          <div className="text-sm text-gray-500 mt-1">{totalReviews.toLocaleString('en-US')} reviews</div>
        </div>

        {/* Right: Distribution bars */}
        <div className="flex-1 space-y-2">
          {distribution.map((item) => (
            <RatingBar key={item.stars} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}

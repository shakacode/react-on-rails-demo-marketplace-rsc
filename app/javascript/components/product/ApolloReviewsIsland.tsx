'use client';

// Apollo L2 client island (issue #255).
//
// This component receives a transported query ref from PreloadQuery via Flight.
// The ReadableStream carrying the query result was serialized as $R rows by
// Flight and reconstructed in the browser by createFromReadableStream.
//
// SimulatePreloadedQuery reads from the transported ref and hydrates the
// Apollo cache — no duplicate network request to /graphql.

import React from 'react';
import { useReadQuery, type QueryRef } from '@apollo/client/react';

// GraphQL response shapes — graphql-ruby auto-camelCases field names, so these
// differ from the snake_case TS types in types/product.ts (which match the Rails
// serializer / async-props contract). Apollo components use these camelCase shapes.
interface GqlReview {
  id: number;
  rating: number;
  title: string;
  comment: string;
  reviewerName: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
}

interface GqlRatingDistribution {
  stars: number;
  count: number;
  percentage: number;
}

interface GqlReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: GqlRatingDistribution[];
}

// The shape returned by GET_PRODUCT_REVIEWS
interface ProductReviewsData {
  product: {
    reviews: GqlReview[];
    reviewStats: GqlReviewStats;
  };
}

export function ApolloReviewsIsland({ queryRef }: { queryRef: QueryRef<ProductReviewsData> }) {
  const { data } = useReadQuery(queryRef);
  const { reviews, reviewStats } = data.product;

  return (
    <div className="space-y-6">
      {/* Review stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl font-bold text-gray-900">{reviewStats.averageRating.toFixed(1)}</span>
          <span className="text-gray-500">/ 5.0</span>
          <span className="text-sm text-gray-500">({reviewStats.totalReviews} reviews)</span>
        </div>
        <div className="space-y-1">
          {reviewStats.distribution.map((d) => (
            <div key={d.stars} className="flex items-center gap-2 text-sm">
              <span className="w-8 text-right text-gray-600">{d.stars}★</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${d.percentage}%` }}
                />
              </div>
              <span className="w-8 text-gray-500">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                <span className="font-medium text-gray-900">{review.title}</span>
              </div>
              {review.verifiedPurchase && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Verified</span>
              )}
            </div>
            <p className="text-gray-700 text-sm mb-2">{review.comment}</p>
            <div className="text-xs text-gray-500 flex items-center gap-3">
              <span>By {review.reviewerName}</span>
              <span>👍 {review.helpfulCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

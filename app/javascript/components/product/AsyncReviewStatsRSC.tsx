import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { ReviewDistributionChart } from './ReviewDistributionChart';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

const CachedReviewStats = cacheComponent(
  async ({ distribution, averageRating, totalReviews }: { distribution: number[]; averageRating: number; totalReviews: number }) => (
    <ReviewDistributionChart
      distribution={distribution}
      averageRating={averageRating}
      totalReviews={totalReviews}
    />
  ),
  { id: 'product-review-stats', revalidate: 60 },
);

export default async function AsyncReviewStatsRSC({ getReactOnRailsAsyncProp }: Props) {
  const data = await getReactOnRailsAsyncProp('review_stats');

  return (
    <CachedReviewStats
      distribution={data.distribution}
      averageRating={data.average_rating}
      totalReviews={data.total_reviews}
    />
  );
}

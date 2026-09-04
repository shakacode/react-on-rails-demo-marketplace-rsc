// Server-only async component — pull-mode variant of AsyncReviewStatsRSC.
//
// Uses getAsyncProp() from the request-scoped asyncPropStore. On a cache HIT
// the component never runs, so no propRequest is sent and Rails skips the
// review_stats DB query entirely.

import React from 'react';
import { RatingDistribution } from '../../types/product';
import { cacheComponent } from '../../utils/rscCache';
import { getAsyncProp } from '../../utils/asyncPropStore';
import { ReviewDistributionChart } from './ReviewDistributionChart';

interface Props {
  productId: number;
}

const CachedPullReviewStats = cacheComponent(
  async ({ productId }: { productId: number }) => {
    const data = await getAsyncProp('review_stats');
    return (
      <ReviewDistributionChart
        distribution={data.distribution as RatingDistribution[]}
        averageRating={data.average_rating as number}
        totalReviews={data.total_reviews as number}
      />
    );
  },
  { id: 'pull-product-review-stats', revalidate: 60 },
);

export default async function AsyncReviewStatsPullRSC({ productId }: Props) {
  return <CachedPullReviewStats productId={productId} />;
}

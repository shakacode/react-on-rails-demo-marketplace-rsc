// Server-only async component — pull-mode variant of AsyncReviewsRSC.
//
// Uses getAsyncProp() from the request-scoped asyncPropStore. On a cache HIT
// the component never runs, so no propRequest is sent and Rails skips the
// reviews DB query entirely.

import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { getAsyncProp } from '../../utils/asyncPropStore';
import { ProductReview } from '../../types/product';
import { ReviewsList } from './ReviewsList';

const CachedPullReviewsList = cacheComponent(
  async (_props: Record<string, never>) => {
    const data = await getAsyncProp('reviews');
    return <ReviewsList reviews={data.reviews as ProductReview[]} />;
  },
  { id: 'pull-product-reviews', revalidate: 60 },
);

export default async function AsyncReviewsPullRSC() {
  return <CachedPullReviewsList />;
}

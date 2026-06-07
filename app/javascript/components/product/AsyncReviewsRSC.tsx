import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { ProductReview } from '../../types/product';
import { ReviewsList } from './ReviewsList';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

const CachedReviewsList = cacheComponent(
  async ({ reviews }: { reviews: ProductReview[] }) => <ReviewsList reviews={reviews} />,
  { id: 'product-reviews', revalidate: 60 },
);

export default async function AsyncReviewsRSC({ getReactOnRailsAsyncProp }: Props) {
  const data = await getReactOnRailsAsyncProp('reviews');

  return <CachedReviewsList reviews={data.reviews} />;
}

// Server-only async component — pull-mode variant of AsyncRelatedProductsRSC.
//
// Uses getAsyncProp() from the request-scoped asyncPropStore. On a cache HIT
// the component never runs, so no propRequest is sent and Rails skips the
// related_products DB query entirely.

import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { getAsyncProp } from '../../utils/asyncPropStore';
import { RelatedProducts } from './RelatedProducts';

interface Props {
  productId: number;
}

interface RelatedProduct {
  id: number;
  name: string;
  price: number;
  original_price: number | null;
  category: string;
  brand: string;
  images: { url: string; alt: string; position: number }[];
  average_rating: number;
  review_count: number;
  in_stock: boolean;
  discount_percentage: number | null;
}

const CachedPullRelatedProducts = cacheComponent(
  async ({ productId }: { productId: number }) => {
    const data = await getAsyncProp('related_products');
    return <RelatedProducts products={data.products as RelatedProduct[]} />;
  },
  { id: 'pull-product-related', revalidate: 60 },
);

export default async function AsyncRelatedProductsPullRSC({ productId }: Props) {
  return <CachedPullRelatedProducts productId={productId} />;
}

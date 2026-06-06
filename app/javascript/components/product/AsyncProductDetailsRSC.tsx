// Server-only async component — streams below-the-fold product details.
// Markdown rendering (marked + highlight.js) happens here, never shipped to client.
//
// #83: the rendered fragment is wrapped in `unstable_cache`, which memoizes its
// serialized RSC payload keyed by product id (+ the resolved details, which are
// deterministic per product). On a warm cache hit the marked / highlight.js
// markdown render is skipped entirely — the stored Flight bytes are replayed.

import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { ProductDescription } from './ProductDescription';
import { ProductFeatures } from './ProductFeatures';
import { ProductSpecs } from './ProductSpecs';

interface ProductDetails {
  description: string;
  features: string[];
  specs: Record<string, string>;
}

interface Props {
  productId: number;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

const CachedProductDetails = cacheComponent(
  async ({ details }: { productId: number; details: ProductDetails }) => (
    <>
      <ProductDescription description={details.description} />
      <ProductFeatures features={details.features} />
      <ProductSpecs specs={details.specs} />
    </>
  ),
  { id: 'product-details', revalidate: 60 },
);

export default async function AsyncProductDetailsRSC({ productId, getReactOnRailsAsyncProp }: Props) {
  const details = (await getReactOnRailsAsyncProp('product_details')) as ProductDetails;

  return <CachedProductDetails productId={productId} details={details} />;
}

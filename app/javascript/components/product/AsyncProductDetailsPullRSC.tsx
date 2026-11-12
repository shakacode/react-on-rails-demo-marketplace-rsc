// Server-only async component — pull-mode variant of AsyncProductDetailsRSC.
//
// Uses getAsyncProp() from the request-scoped asyncPropStore instead of
// receiving getReactOnRailsAsyncProp as a prop. The async prop fetch happens
// INSIDE the cacheComponent boundary:
//
// On MISS: getAsyncProp('product_details') fires → propRequest → Rails DB query → render → cache.
// On HIT: cached Flight bytes replay directly — component never runs → no propRequest → no DB query.

import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { getAsyncProp } from '../../utils/asyncPropStore';
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
}

const CachedProductDetails = cacheComponent(
  async ({ productId }: { productId: number }) => {
    const details = (await getAsyncProp('product_details')) as ProductDetails;
    return (
      <>
        <ProductDescription description={details.description} />
        <ProductFeatures features={details.features} />
        <ProductSpecs specs={details.specs} />
      </>
    );
  },
  { id: 'pull-product-details', revalidate: 60 },
);

export default async function AsyncProductDetailsPullRSC({ productId }: Props) {
  return <CachedProductDetails productId={productId} />;
}

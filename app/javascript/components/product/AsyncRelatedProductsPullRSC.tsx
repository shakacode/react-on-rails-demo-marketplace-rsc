// Server-only async component — pull-mode variant of AsyncRelatedProductsRSC.
//
// Uses getAsyncProp() from the request-scoped asyncPropStore. On a cache HIT
// the component never runs, so no propRequest is sent and Rails skips the
// related_products DB query entirely.

import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { getAsyncProp } from '../../utils/asyncPropStore';
import { RelatedProducts } from './RelatedProducts';

const CachedPullRelatedProducts = cacheComponent(
  async (_props: Record<string, never>) => {
    const data = await getAsyncProp('related_products');
    return <RelatedProducts products={data.products} />;
  },
  { id: 'pull-product-related', revalidate: 60 },
);

export default async function AsyncRelatedProductsPullRSC() {
  return <CachedPullRelatedProducts />;
}

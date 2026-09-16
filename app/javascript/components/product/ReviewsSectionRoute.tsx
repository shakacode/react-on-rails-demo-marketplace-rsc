'use client';

// C5 (issue #245): client-side mount point for the nested reviews-section
// route. This wrapper MUST be a 'use client' module in app/javascript:
// the RSC bundle turns any imported 'use client' file into a flight client
// reference, and both client-reference manifests are built by scanning
// app/javascript ONLY (config/rspack/serverRspackConfig.js
// rspackDefaultClientReferences / config/webpack/rscClientReferences.js), so
// a server component importing react-on-rails-pro/RSCRoute directly would
// reference a node_modules file no manifest can resolve — and in fact fails
// the RSC bundle build outright (upstream react_on_rails#5079).
//
// The Suspense boundary gives the nested route its streaming fallback during
// initial SSR (the section payload is generated through the SAME rendering
// request as the page, so its async props resolve from the page's emit
// block); the skeletons match the inline section's to keep CLS at zero.

import React, { Suspense } from 'react';
import RSCRoute from 'react-on-rails-pro/RSCRoute';
import { ReviewStatsSkeleton, ReviewsSkeleton } from './ProductSkeletons';

interface ReviewsSectionRouteProps {
  productId: number;
  reviewMutationEnabled: boolean;
}

export function ReviewsSectionRoute({ productId, reviewMutationEnabled }: ReviewsSectionRouteProps) {
  return (
    <Suspense
      fallback={
        <div>
          <ReviewStatsSkeleton />
          <div className="mt-8">
            <ReviewsSkeleton />
          </div>
        </div>
      }
    >
      <RSCRoute
        componentName="ProductReviewsSectionRSC"
        componentProps={{ product_id: productId, review_mutation_enabled: reviewMutationEnabled }}
      />
    </Suspense>
  );
}

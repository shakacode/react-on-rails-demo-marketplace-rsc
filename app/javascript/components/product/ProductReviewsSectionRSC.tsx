// No 'use client' — this is a server component (RSC bundle).
//
// C5 (issue #245): the reviews section as its own refetchable server
// component, mounted inside ProductPageRSC through a nested <RSCRoute>
// (see ReviewsSectionRoute in ReviewMutationIsland.tsx). Two render doors:
//
//   * initial page render — the nested route's payload is generated through
//     the SAME rendering request as the page (generateRSCPayload swaps the
//     component name/props into the request and reruns it on the RSC bundle),
//     so getReactOnRailsAsyncProp here resolves from the page's ONE emit
//     block (ProductRscProps.emit_all) — review_stats/reviews are emitted
//     once and consumed by both the inline section and this one;
//   * section refetch — the island below asks its NEAREST route to refetch,
//     which GETs /rsc_payload/ProductReviewsSectionRSC?props={product_id,...}
//     and is served by the ProductReviewsSectionRSC branch of
//     app/views/react_on_rails_pro/rsc_payload.text.erb, emitting ONLY
//     review_stats + reviews (ProductRscProps.emit_reviews_section).
//
// The AsyncReviewStatsRSC / AsyncReviewsRSC children (and their
// cacheComponent wrappers) are the same modules the inline section uses, so
// the C5 comparison measures the route scoping, not a different tree.

import React, { Suspense } from 'react';
import { ReviewMutationIsland } from './ReviewMutationIslandForServer';
import AsyncReviewStatsRSC from './AsyncReviewStatsRSC';
import AsyncReviewsRSC from './AsyncReviewsRSC';
import { ReviewStatsSkeleton, ReviewsSkeleton } from './ProductSkeletons';

interface Props {
  product_id: number;
  // Server-set flag (ENABLE_SPIKE_MUTATIONS), rebuilt server-side by the
  // payload door — the island renders only where its write endpoint exists.
  review_mutation_enabled?: boolean;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default function ProductReviewsSectionRSC({
  product_id,
  review_mutation_enabled,
  getReactOnRailsAsyncProp,
}: Props) {
  return (
    <div data-testid="reviews-section-route">
      {review_mutation_enabled && <ReviewMutationIsland productId={product_id} scope="section" />}

      <Suspense fallback={<ReviewStatsSkeleton />}>
        <AsyncReviewStatsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
      </Suspense>

      <div className="mt-8">
        <Suspense fallback={<ReviewsSkeleton />}>
          <AsyncReviewsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>
      </div>
    </div>
  );
}

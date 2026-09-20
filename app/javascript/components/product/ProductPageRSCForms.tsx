// No 'use client' — this is a server component (RSC bundle).
//
// Issue #244: Dedicated form-library comparison page.
// Lives at /product/rsc-forms so the benchmarked /product/rsc stays clean.
//
// Shows all four form variants (React 19 built-ins, Conform, RHF+zod,
// TanStack Form) posting to the same Rails endpoint, plus the reviews
// section needed for RSCRoute.refetch() to show results.
//
// The POST endpoint is gated by ENABLE_SPIKE_MUTATIONS — without it the
// forms render but submission 404s.

import React, { Suspense } from 'react';
import { Product } from '../../types/product';
import { ReviewMutationIsland } from './ReviewMutationIslandForServer';
import { ReviewFormIsland } from './ReviewFormIslandForServer';
import { ReviewFormConformIsland } from './ReviewFormConformIslandForServer';
import { ReviewFormRHFIsland } from './ReviewFormRHFIslandForServer';
import { ReviewFormTanStackIsland } from './ReviewFormTanStackIslandForServer';
import AsyncReviewStatsRSC from './AsyncReviewStatsRSC';
import AsyncReviewsRSC from './AsyncReviewsRSC';
import { ReviewStatsSkeleton, ReviewsSkeleton } from './ProductSkeletons';

interface Props {
  product: Product;
  // Server-set flag (ENABLE_SPIKE_MUTATIONS): the write endpoint and spike
  // mutation island are gated behind this. Production never sets it.
  review_mutation_enabled?: boolean;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default function ProductPageRSCForms({ product, review_mutation_enabled, getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Page header */}
        <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-6">
          Issue #244 — Form library comparison on RSC pages. This page is separate
          from <a href="/product/rsc" className="underline">/product/rsc</a> so
          benchmark numbers stay unperturbed.
        </p>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
        <p className="text-gray-600 mb-8">
          Each form below submits to the same Rails endpoint
          (<code className="text-sm">POST /products/{product.id}/reviews</code>)
          and refetches the review list via <code className="text-sm">RSCRoute.refetch()</code>.
        </p>

        {/* Form variants */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Form Variants</h2>

          {/* Spike button (existing #245) — gated on ENABLE_SPIKE_MUTATIONS */}
          {review_mutation_enabled && <ReviewMutationIsland productId={product.id} />}

          {/* Phase 1: React 19 built-ins (no form library) */}
          {review_mutation_enabled && <ReviewFormIsland productId={product.id} />}

          {/* Phase 2: library variants */}
          {review_mutation_enabled && <ReviewFormConformIsland productId={product.id} />}
          {review_mutation_enabled && <ReviewFormRHFIsland productId={product.id} />}
          {review_mutation_enabled && <ReviewFormTanStackIsland productId={product.id} />}
        </section>

        {/* Reviews section — needed for refetch() to show results */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

          <Suspense fallback={<ReviewStatsSkeleton />}>
            <AsyncReviewStatsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>

          <div className="mt-8">
            <Suspense fallback={<ReviewsSkeleton />}>
              <AsyncReviewsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}

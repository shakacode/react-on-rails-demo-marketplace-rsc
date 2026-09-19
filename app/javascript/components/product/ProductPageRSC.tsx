// No 'use client' — this is a server component (RSC bundle).
//
// V3: RSC Streaming — Shell streams immediately, heavy data streams progressively.
//
// Libraries that stay SERVER-SIDE (never shipped to browser):
//   - marked + highlight.js (~350KB) — used by ProductDescription
//   - date-fns (~30KB) — used by ReviewCard
//   - ReviewDistributionChart SVG rendering — component code stays server-side
//   - ReviewsList, ReviewCard, RelatedProducts — all stay server-side
//
// Only shipped to client:
//   - ProductImageGallery (~3KB) — interactive image navigation
//   - AddToCartSection (~2KB) — quantity selector + add to cart
//
// Total JS savings: ~400KB+ eliminated from client bundle.

import React, { Suspense } from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
import { ReviewMutationIsland } from './ReviewMutationIslandForServer';
import { ReviewFormIsland } from './ReviewFormIslandForServer';
import { ReviewFormConformIsland } from './ReviewFormConformIslandForServer';
import { ReviewFormRHFIsland } from './ReviewFormRHFIslandForServer';
import { ReviewFormTanStackIsland } from './ReviewFormTanStackIslandForServer';
import { ReviewsSectionRoute } from './ReviewsSectionRouteForServer';
import AsyncProductDetailsRSC from './AsyncProductDetailsRSC';
import AsyncReviewStatsRSC from './AsyncReviewStatsRSC';
import AsyncReviewsRSC from './AsyncReviewsRSC';
import AsyncRelatedProductsRSC from './AsyncRelatedProductsRSC';
import { ProductDetailsSkeleton, ReviewStatsSkeleton, ReviewsSkeleton, RelatedProductsSkeleton } from './ProductSkeletons';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { ProductSpecSheet } from './ProductSpecSheetForServer';
import { buildProductSpecMarkdown } from './productSpecMarkdown';

interface Props {
  product: Product;
  // Server-set flag (ENABLE_SPIKE_MUTATIONS): the #245 mutation island renders
  // only where its gated write endpoint actually exists. Production never sets it.
  review_mutation_enabled?: boolean;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

// #83: cache the rendered RSC payload of the long-form markdown spec sheet,
// keyed by product sku (+ the markdown source, deterministic per product).
// The heavy marked / highlight.js / sanitize-html render runs once per product
// then replays from cache.
const CachedProductSpecSheet = cacheComponent(
  async ({
    productName,
    productPriceUsd,
    specMarkdown,
  }: {
    sku: string;
    productName: string;
    productPriceUsd: number;
    specMarkdown: string;
  }) => (
    <ProductSpecSheet productName={productName} productPriceUsd={productPriceUsd} specMarkdown={specMarkdown} />
  ),
  { id: 'product-spec-sheet', revalidate: 60 },
);

export default function ProductPageRSC({ product, review_mutation_enabled, getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-6">
          V3: RSC Streaming — marked + highlight.js + date-fns stay server-side, 0KB to client. Data streams progressively.
        </p>

        {/* Breadcrumb — server-rendered HTML, never enters client bundle on RSC page */}
        <Breadcrumb crumbs={buildProductCrumbs(product)} />

        {/* Hero section: Image gallery + Product info — renders IMMEDIATELY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
          <ProductImageGallery images={product.images} productName={product.name} />
          <div className="space-y-6">
            <ProductInfo product={product} />
            <div className="border-t border-gray-200 pt-6">
              <AddToCartSection
                price={product.price}
                inStock={product.in_stock}
                stockQuantity={product.stock_quantity}
              />
            </div>
          </div>
        </div>

        {/* Product details — below the fold, streamed to prioritize hero section for LCP */}
        <Suspense fallback={<ProductDetailsSkeleton />}>
          <AsyncProductDetailsRSC productId={product.id} getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>

        {/* Reviews section — streams as data resolves */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

          {/* Read-your-writes spike (#245): POST a canned review, then RSCRoute.refetch().
              Rendered only where the gated write endpoint exists (ENABLE_SPIKE_MUTATIONS). */}
          {review_mutation_enabled && <ReviewMutationIsland productId={product.id} />}

          {/* Issue #244 Phase 1: React 19 built-ins review form (no form library).
              Rendered alongside the spike button for A/B comparison during evaluation.
              Gated like the spike: absent unless ENABLE_SPIKE_MUTATIONS. */}
          {review_mutation_enabled && <ReviewFormIsland productId={product.id} />}

          {/* Issue #244 Phase 2: form-library variants for the matrix comparison.
              Each library variant renders the same form with a different approach.
              Gated like the baseline: absent unless ENABLE_SPIKE_MUTATIONS. */}
          {review_mutation_enabled && <ReviewFormConformIsland productId={product.id} />}
          {review_mutation_enabled && <ReviewFormRHFIsland productId={product.id} />}
          {review_mutation_enabled && <ReviewFormTanStackIsland productId={product.id} />}

          {/* Review stats stream first (rating distribution aggregation) */}
          <Suspense fallback={<ReviewStatsSkeleton />}>
            <AsyncReviewStatsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>

          {/* Reviews stream after stats (complex sort query) */}
          <div className="mt-8">
            <Suspense fallback={<ReviewsSkeleton />}>
              <AsyncReviewsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
            </Suspense>
          </div>

          {/* C5 experiment (#245): a SECOND copy of the reviews section mounted
              through a nested <RSCRoute componentName="ProductReviewsSectionRSC">.
              Its island resolves useCurrentRSCRoute() to the NEAREST (nested)
              route, so its refetch re-streams only review_stats + reviews
              through the payload door, leaving the rest of the page untouched.
              Rendered as an ADDITIONAL block (not a replacement) so the merged
              whole-page path above keeps its exact behavior for comparison —
              and because a nested route pins its subtree to its own payload
              cache key, replacing the inline section would make the page-level
              refetch serve the section from the provider cache (stale).
              Gated like the island: absent unless ENABLE_SPIKE_MUTATIONS. */}
          {review_mutation_enabled && (
            <div
              className="mt-10 rounded-xl border-2 border-dashed border-indigo-300 p-4"
              data-testid="c5-section-experiment"
            >
              <p className="mb-4 text-sm text-indigo-800">
                C5 experiment (#245): the block below is a nested RSCRoute — its button refetches ONLY this
                section through the payload door.
              </p>
              <ReviewsSectionRoute productId={product.id} reviewMutationEnabled={Boolean(review_mutation_enabled)} />
            </div>
          )}
        </section>

        {/* Related products — streams last (recommendation query) */}
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <AsyncRelatedProductsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>

        {/* Long-form spec sheet (markdown) + multi-currency price ladder.
            Heavy markdown stack runs SERVER-SIDE only on this variant. */}
        <CachedProductSpecSheet
          sku={product.sku}
          productName={product.name}
          productPriceUsd={product.price}
          specMarkdown={buildProductSpecMarkdown(product.name, product.sku)}
        />
      </div>
    </div>
  );
}

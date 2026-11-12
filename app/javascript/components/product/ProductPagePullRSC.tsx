// No 'use client' — this is a server component (RSC bundle).
//
// V5: RSC Pull-Mode Streaming — bidirectional async props with unstable_cache.
//
// Like ProductPageRSC (V3) but uses pull-mode: React requests props on demand
// instead of Rails pushing them eagerly. Combined with unstable_cache, cached
// components never request their prop → Rails never queries the DB for it.
//
// Uses React.cache()-based asyncPropStore to eliminate prop drilling of
// getReactOnRailsAsyncProp — children import getAsyncProp() directly.
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

import React, { Suspense } from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { initAsyncPropStore } from '../../utils/asyncPropStore';
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
import AsyncProductDetailsPullRSC from './AsyncProductDetailsPullRSC';
import AsyncReviewStatsPullRSC from './AsyncReviewStatsPullRSC';
import AsyncReviewsPullRSC from './AsyncReviewsPullRSC';
import AsyncRelatedProductsPullRSC from './AsyncRelatedProductsPullRSC';
import { ProductDetailsSkeleton, ReviewStatsSkeleton, ReviewsSkeleton, RelatedProductsSkeleton } from './ProductSkeletons';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { ProductSpecSheet } from './ProductSpecSheetForServer';
import { buildProductSpecMarkdown } from './productSpecMarkdown';

interface Props {
  product: Product;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

// #83: cache the rendered RSC payload of the long-form markdown spec sheet.
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

export default function ProductPagePullRSC({ product, getReactOnRailsAsyncProp }: Props) {
  // Initialize the request-scoped async prop store. Children call
  // getAsyncProp() from the store instead of receiving it as a prop.
  initAsyncPropStore(getReactOnRailsAsyncProp);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 mb-6">
          V5: RSC Pull-Mode — bidirectional async props + unstable_cache. On cache hit, props are not pulled and DB queries are skipped.
        </p>

        {/* Breadcrumb — server-rendered HTML */}
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

        {/* Product details — pull-cached: on HIT, product_details prop is never requested */}
        <Suspense fallback={<ProductDetailsSkeleton />}>
          <AsyncProductDetailsPullRSC productId={product.id} />
        </Suspense>

        {/* Reviews section — pull-cached: on HIT, review_stats and reviews props are never requested */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

          <Suspense fallback={<ReviewStatsSkeleton />}>
            <AsyncReviewStatsPullRSC productId={product.id} />
          </Suspense>

          <div className="mt-8">
            <Suspense fallback={<ReviewsSkeleton />}>
              <AsyncReviewsPullRSC productId={product.id} />
            </Suspense>
          </div>
        </section>

        {/* Related products — pull-cached: on HIT, related_products prop is never requested */}
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <AsyncRelatedProductsPullRSC productId={product.id} />
        </Suspense>

        {/* Long-form spec sheet — uses regular cacheComponent (sync data from product) */}
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

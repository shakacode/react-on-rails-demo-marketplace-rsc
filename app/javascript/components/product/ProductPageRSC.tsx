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
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
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
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default function ProductPageRSC({ product, getReactOnRailsAsyncProp }: Props) {
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
          <AsyncProductDetailsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>

        {/* Reviews section — streams as data resolves */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

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
        </section>

        {/* Related products — streams last (recommendation query) */}
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <AsyncRelatedProductsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>

        {/* Long-form spec sheet (markdown) + multi-currency price ladder.
            Heavy markdown stack runs SERVER-SIDE only on this variant. */}
        <ProductSpecSheet
          productName={product.name}
          productPriceUsd={product.price}
          specMarkdown={buildProductSpecMarkdown(product.name, product.sku)}
        />
      </div>
    </div>
  );
}

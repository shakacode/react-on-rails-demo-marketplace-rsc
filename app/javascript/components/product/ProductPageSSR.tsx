'use client';

// V1: Full SSR — ALL data fetched on server, returned at once.
// ALL component code + libraries (marked, highlight.js, date-fns, chart rendering)
// are shipped to the client for hydration.
// FCP/LCP blocked until ALL data is ready.

import React from 'react';
import { Product, ProductReview, ReviewStats, ProductCard } from '../../types/product';
import { ProductImageGallery } from './ProductImageGallery';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSection';
import { ProductDescription } from './ProductDescription';
import { ProductFeatures } from './ProductFeatures';
import { ProductSpecs } from './ProductSpecs';
import { ReviewDistributionChart } from './ReviewDistributionChart';
import { ReviewsList } from './ReviewsList';
import { RelatedProducts } from './RelatedProducts';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { ProductSpecSheet } from './ProductSpecSheet';
import { buildProductSpecMarkdown } from './productSpecMarkdown';

interface Props {
  product: Product;
  reviews: ProductReview[];
  review_stats: ReviewStats;
  related_products: ProductCard[];
}

export default function ProductPageSSR({ product, reviews, review_stats, related_products }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6">
          V1: Full SSR — marked + highlight.js + date-fns (400KB+) shipped to client for hydration. All data blocks initial response.
        </p>

        <Breadcrumb crumbs={buildProductCrumbs(product)} />

        {/* Hero section: Image gallery + Product info */}
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

        {/* Product description (uses marked + highlight.js) */}
        <ProductDescription description={product.description} />

        {/* Features */}
        <ProductFeatures features={product.features} />

        {/* Specifications */}
        <ProductSpecs specs={product.specs} />

        {/* Reviews section */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
          <ReviewDistributionChart
            distribution={review_stats.distribution}
            averageRating={review_stats.average_rating}
            totalReviews={review_stats.total_reviews}
          />
          <div className="mt-8">
            <ReviewsList reviews={reviews} />
          </div>
        </section>

        {/* Related products */}
        <RelatedProducts products={related_products} />

        {/* Long-form spec sheet (markdown) + multi-currency price ladder.
            Heavy markdown stack runs both server-side (SSR) and client-side
            (during hydration) on this variant. */}
        <ProductSpecSheet
          productName={product.name}
          productPriceUsd={product.price}
          specMarkdown={buildProductSpecMarkdown(product.name, product.sku)}
        />
      </div>
    </div>
  );
}

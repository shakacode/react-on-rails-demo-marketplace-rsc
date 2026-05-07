'use client';

// V2: Client Components — basic product info SSRed, heavy content lazy-loaded.
// Libraries are loaded in async chunks after initial page load.
// Multiple API round-trips for reviews, stats, and related products.

import React from 'react';
import loadable from '@loadable/component';
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGallery';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSection';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { ProductSpecSheet } from './ProductSpecSheet';
import { buildProductSpecMarkdown } from './productSpecMarkdown';

const AsyncProductContent = loadable(
  () => import('./AsyncProductContent'),
  {
    fallback: (
      <div className="animate-pulse space-y-8 mt-8">
        <div className="border-t border-gray-200 pt-8">
          <div className="h-7 w-48 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/5" />
          </div>
        </div>
      </div>
    )
  }
);

interface Props {
  product: Product;
}

export default function ProductPageClient({ product }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
          V2: Client Components — <code className="bg-white/60 px-1 rounded">@loadable/component</code> loads <code className="bg-white/60 px-1 rounded">AsyncProductContent</code> (reviews, charts, related products) after first paint via API calls.
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

        {/* Lazy-loaded content (fetches data via API + loads heavy libraries) */}
        <AsyncProductContent product={product} />

        {/* Long-form spec sheet (markdown) + multi-currency price ladder */}
        <ProductSpecSheet
          productName={product.name}
          productPriceUsd={product.price}
          specMarkdown={buildProductSpecMarkdown(product.name, product.sku)}
        />
      </div>
    </div>
  );
}

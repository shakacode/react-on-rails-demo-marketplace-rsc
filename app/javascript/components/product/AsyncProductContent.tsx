'use client';

// Client-side fetcher for V2 (Client Components version).
// Fetches reviews, review stats, and related products via API calls.
// All libraries (date-fns, marked, highlight.js) are loaded client-side.

import React, { useState, useEffect } from 'react';
import { Product, ProductReview, ReviewStats, ProductCard } from '../../types/product';
import { ProductDescription } from './ProductDescription';
import { ProductFeatures } from './ProductFeatures';
import { ProductSpecs } from './ProductSpecs';
import { ReviewDistributionChart } from './ReviewDistributionChart';
import { ReviewsList } from './ReviewsList';
import { RelatedProducts } from './RelatedProducts';
import { ReviewStatsSkeleton, ReviewsSkeleton, RelatedProductsSkeleton } from './ProductSkeletons';
import { appendDelay } from '../../utils/delayParam';

interface Props {
  product: Product;
}

export default function AsyncProductContent({ product }: Props) {
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<ProductReview[] | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    fetch(appendDelay(`/api/products/${product.id}/review_stats`), opts)
      .then((r) => r.json())
      .then(setReviewStats)
      .catch(() => {});

    fetch(appendDelay(`/api/products/${product.id}/reviews`), opts)
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews))
      .catch(() => {});

    fetch(appendDelay(`/api/products/${product.id}/related_products`), opts)
      .then((r) => r.json())
      .then((data) => setRelatedProducts(data.products))
      .catch(() => {});

    return () => controller.abort();
  }, [product.id]);

  return (
    <>
      {/* Product description (uses marked + highlight.js) */}
      <ProductDescription description={product.description} />

      {/* Features */}
      <ProductFeatures features={product.features} />

      {/* Specifications */}
      <ProductSpecs specs={product.specs} />

      {/* Reviews section */}
      <section className="border-t border-gray-200 pt-8 mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
        {reviewStats ? (
          <ReviewDistributionChart
            distribution={reviewStats.distribution}
            averageRating={reviewStats.average_rating}
            totalReviews={reviewStats.total_reviews}
          />
        ) : (
          <ReviewStatsSkeleton />
        )}
        <div className="mt-8">
          {reviews ? <ReviewsList reviews={reviews} /> : <ReviewsSkeleton />}
        </div>
      </section>

      {/* Related products */}
      {relatedProducts ? (
        <RelatedProducts products={relatedProducts} />
      ) : (
        <RelatedProductsSkeleton />
      )}
    </>
  );
}

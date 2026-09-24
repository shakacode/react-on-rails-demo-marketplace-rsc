// No 'use client' — this is a server component (RSC bundle).
//
// L1: Apollo Client RSC — Server-Only Query (issue #255).
//
// All data is fetched via GraphQL on the server. Zero Apollo JavaScript
// reaches the browser — the query result is rendered into RSC HTML and
// streamed to the client like any other server component.
//
// This demonstrates registerApolloClient + getClient().query() in a
// React on Rails RSC page, proving per-request client isolation via
// React.cache() and correct three-bundle export resolution.

import React from 'react';
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
import { ReviewsList } from './ReviewsList';
import { ReviewDistributionChart } from './ReviewDistributionChart';
import { RelatedProducts } from './RelatedProducts';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { getClient } from '../apollo/apolloClient';
import { GET_PRODUCT_FULL } from '../apollo/queries';

interface Props {
  product: Product;
}

// GraphQL response uses camelCase (graphql-ruby auto-converts), while existing
// server components use the snake_case shapes from types/product.ts. L1 stays
// server-only so we map the camelCase response to the existing component props.
export default async function ProductPageApolloL1RSC({ product }: Props) {
  // Query the Rails /graphql endpoint via Apollo's HttpLink.
  // getClient() returns a per-request-isolated ApolloClient (React.cache scoped).
  const { data } = await getClient().query({
    query: GET_PRODUCT_FULL,
    variables: { id: String(product.id) },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gqlProduct = (data as any).product;

  // Map camelCase GraphQL response to the snake_case props that ReviewsList,
  // ReviewDistributionChart, and RelatedProducts expect. These components are
  // shared with the non-Apollo RSC pages and use the Rails serializer shapes.
  const reviews = gqlProduct.reviews.map((r: Record<string, unknown>) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    reviewer_name: r.reviewerName,
    verified_purchase: r.verifiedPurchase,
    helpful_count: r.helpfulCount,
    created_at: r.createdAt,
  }));
  const reviewStats = {
    average_rating: gqlProduct.reviewStats.averageRating,
    total_reviews: gqlProduct.reviewStats.totalReviews,
    distribution: gqlProduct.reviewStats.distribution,
  };
  const relatedProducts = gqlProduct.relatedProducts.map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    original_price: p.originalPrice,
    category: p.category,
    brand: p.brand,
    images: p.images,
    average_rating: p.averageRating,
    review_count: p.reviewCount,
    in_stock: p.inStock,
    discount_percentage: p.discountPercentage,
  }));

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 mb-6">
          Apollo L1: Server-Only GraphQL — All data fetched via Apollo Client on the server.
          Zero Apollo JS in browser. Query runs through HttpLink → Rails /graphql.
        </p>

        <Breadcrumb crumbs={buildProductCrumbs(product)} />

        {/* Hero section */}
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

        {/* Product description from GraphQL */}
        {gqlProduct.description && (
          <section className="border-t border-gray-200 pt-8 mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 leading-relaxed">{gqlProduct.description}</p>
          </section>
        )}

        {/* Reviews from GraphQL */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
          <ReviewDistributionChart
            distribution={reviewStats.distribution}
            averageRating={reviewStats.average_rating}
            totalReviews={reviewStats.total_reviews}
          />
          <div className="mt-8">
            <ReviewsList reviews={reviews} />
          </div>
        </section>

        {/* Related products from GraphQL */}
        <RelatedProducts products={relatedProducts} />
      </div>
    </div>
  );
}

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
import { Product, ProductReview, ReviewStats, ProductCard } from '../../types/product';
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

export default async function ProductPageApolloL1RSC({ product }: Props) {
  // Query the Rails /graphql endpoint via Apollo's HttpLink.
  // getClient() returns a per-request-isolated ApolloClient (React.cache scoped).
  const { data } = await getClient().query({
    query: GET_PRODUCT_FULL,
    variables: { id: String(product.id) },
  });

  const gqlProduct = data.product;
  const reviews: ProductReview[] = gqlProduct.reviews;
  const reviewStats: ReviewStats = gqlProduct.reviewStats;
  const relatedProducts: ProductCard[] = gqlProduct.relatedProducts;

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
          <ReviewDistributionChart stats={reviewStats} />
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

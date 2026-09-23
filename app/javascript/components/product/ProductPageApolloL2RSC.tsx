// No 'use client' — this is a server component (RSC bundle).
//
// L2: Apollo Client RSC — PreloadQuery → Flight → Client Hydration (issue #255).
//
// The product hero data is rendered server-side via a GraphQL query that
// excludes reviews (GET_PRODUCT_WITHOUT_REVIEWS). The reviews section uses
// PreloadQuery with a separate query (GET_PRODUCT_REVIEWS): the Apollo query
// runs on the server, and the result travels through Flight as a ReadableStream
// ($R rows) to the ApolloReviewsIsland client component, which hydrates the
// Apollo cache without a duplicate network request.
//
// ApolloProviderWrapper wraps the client island to satisfy SimulatePreloadedQuery's
// useApolloClient() requirement — it creates a browser-only ApolloClient.
//
// This demonstrates the Flight-native L2 transport: no buildManualDataTransport,
// no HTML stream injection hook — Flight's ReadableStream serialization IS
// the transport.

import React, { Suspense } from 'react';
import { Product } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
import { RelatedProducts } from './RelatedProducts';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { getClient, getPreloadQuery } from '../apollo/apolloClient';
import { GET_PRODUCT_WITHOUT_REVIEWS, GET_PRODUCT_REVIEWS } from '../apollo/queries';
import { ApolloReviewsIsland } from './ApolloReviewsIsland';
import { ApolloProviderWrapper } from '../apollo/ApolloProviderWrapper';
import { ReviewsSkeleton } from './ProductSkeletons';

interface Props {
  product: Product;
}

export default async function ProductPageApolloL2RSC({ product }: Props) {
  // Fetch product data WITHOUT reviews — reviews come from PreloadQuery.
  // This avoids the duplicate-query problem: one request for the page shell,
  // one for the reviews transported to the client.
  const { data } = await getClient().query({
    query: GET_PRODUCT_WITHOUT_REVIEWS,
    variables: { id: String(product.id) },
  });

  const gqlProduct = data.product;

  // PreloadQuery is only available in the RSC bundle (react-server condition).
  // Resolved lazily to avoid Rspack ESM linking errors in the SSR bundle.
  const PreloadQuery = getPreloadQuery();

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Version indicator */}
        <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-6">
          Apollo L2: PreloadQuery → Flight → Client Hydration — Product rendered server-side,
          reviews preloaded and transported via Flight ReadableStream to a client island.
        </p>

        <Breadcrumb crumbs={buildProductCrumbs(product)} />

        {/* Hero section — server rendered, no Apollo in browser */}
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

        {/* Product description — server rendered */}
        {gqlProduct.description && (
          <section className="border-t border-gray-200 pt-8 mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 leading-relaxed">{gqlProduct.description}</p>
          </section>
        )}

        {/* Reviews — PreloadQuery transports the result through Flight.
            The ReadableStream with query data is serialized as $R rows,
            embedded in the RSC payload, and deserialized in the browser.

            ApolloProviderWrapper creates a browser-only ApolloClient +
            ApolloProvider so SimulatePreloadedQuery's useApolloClient() has
            context. ApolloReviewsIsland hydrates from the transported ref
            without a duplicate request. */}
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews (Apollo L2)</h2>
          <ApolloProviderWrapper>
            <Suspense fallback={<ReviewsSkeleton />}>
              <PreloadQuery
                query={GET_PRODUCT_REVIEWS}
                variables={{ id: String(product.id) }}
              >
                {(queryRef: any) => <ApolloReviewsIsland queryRef={queryRef} />}
              </PreloadQuery>
            </Suspense>
          </ApolloProviderWrapper>
        </section>

        {/* Related products — server rendered */}
        <RelatedProducts products={gqlProduct.relatedProducts} />
      </div>
    </div>
  );
}

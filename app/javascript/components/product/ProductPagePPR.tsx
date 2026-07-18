import React, { Suspense } from 'react';
import { unstable_cache } from 'react-on-rails-pro/cache'; // eslint-disable-line camelcase
import { Product, ProductCard, ProductReview, ReviewStats } from '../../types/product';
import { ProductImageGallery } from './ProductImageGalleryForServer';
import { ProductInfo } from './ProductInfo';
import { AddToCartSection } from './AddToCartSectionForServer';
import { Breadcrumb } from './Breadcrumb';
import { buildProductCrumbs } from './productCrumbs';
import { ProductDescription } from './ProductDescription';
import { ProductFeatures } from './ProductFeatures';
import { ProductSpecs } from './ProductSpecs';
import { ProductSpecSheet } from './ProductSpecSheetForServer';
import { buildProductSpecMarkdown } from './productSpecMarkdown';
import { ReviewDistributionChart } from './ReviewDistributionChart';
import { ReviewsList } from './ReviewsList';
import { RelatedProducts } from './RelatedProducts';
import { ProductDetailsSkeleton, ReviewStatsSkeleton, ReviewsSkeleton, RelatedProductsSkeleton } from './ProductSkeletons';

interface AsyncPayloads {
  review_stats: ReviewStats;
  reviews: { reviews: ProductReview[] };
  related_products: { products: ProductCard[] };
}

type AsyncPropReader = <K extends keyof AsyncPayloads>(propName: K) => Promise<AsyncPayloads[K]>;

interface EditorialProductSlice {
  name: Product['name'];
  price: Product['price'];
  sku: Product['sku'];
  description: Product['description'];
  features: Product['features'];
  specs: Product['specs'];
}

interface Props {
  product: Product;
  getReactOnRailsAsyncProp: AsyncPropReader;
}

const CachedStaticEditorialSection = unstable_cache(
  async ({
    editorial,
    specMarkdown,
  }: {
    editorial: EditorialProductSlice;
    specMarkdown: string;
  }) => (
    <>
      <ProductDescription description={editorial.description} />
      <ProductFeatures features={editorial.features} />
      <ProductSpecs specs={editorial.specs} />
      <ProductSpecSheet
        productName={editorial.name}
        productPriceUsd={editorial.price}
        specMarkdown={specMarkdown}
      />
    </>
  ),
  { id: 'product-ppr-static-editorial', revalidate: 60 },
);

function buildEditorialSlice(product: Product): EditorialProductSlice {
  return {
    name: product.name,
    price: product.price,
    sku: product.sku,
    description: product.description,
    features: product.features,
    specs: product.specs,
  };
}

async function ReviewStatsHole({
  getReactOnRailsAsyncProp,
}: {
  getReactOnRailsAsyncProp: AsyncPropReader;
}) {
  const data = await getReactOnRailsAsyncProp('review_stats');

  return (
    <ReviewDistributionChart
      distribution={data.distribution}
      averageRating={data.average_rating}
      totalReviews={data.total_reviews}
    />
  );
}

async function ReviewsHole({
  getReactOnRailsAsyncProp,
}: {
  getReactOnRailsAsyncProp: AsyncPropReader;
}) {
  const data = await getReactOnRailsAsyncProp('reviews');

  return <ReviewsList reviews={data.reviews} />;
}

async function RelatedProductsHole({
  getReactOnRailsAsyncProp,
}: {
  getReactOnRailsAsyncProp: AsyncPropReader;
}) {
  const data = await getReactOnRailsAsyncProp('related_products');

  return <RelatedProducts products={data.products} />;
}

export default function ProductPagePPR({ product, getReactOnRailsAsyncProp }: Props) {
  const editorial = buildEditorialSlice(product);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6">
          V4: Experimental PPR-style RSC. Hero and editorial shell stay inline, static detail content is wrapped with
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5">unstable_cache</code>
          , and live review/recommendation holes still stream per request.
        </p>

        <Breadcrumb crumbs={buildProductCrumbs(product)} />

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

        <section className="border-t border-gray-200 pt-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cached Static Editorial Shell</h2>
              <p className="text-sm text-gray-600">
                Description, feature copy, specs, and the long-form spec sheet are product-stable and shell-cacheable.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Warm hits replay without recomputing markdown</p>
          </div>
          <Suspense fallback={<ProductDetailsSkeleton />}>
            <CachedStaticEditorialSection
              editorial={editorial}
              specMarkdown={buildProductSpecMarkdown(editorial.name, editorial.sku)}
            />
          </Suspense>
        </section>

        <section className="border-t border-gray-200 pt-8 mt-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Live Dynamic Holes</h2>
              <p className="text-sm text-gray-600">
                Review stats, recent reviews, and related products stay request-live to model the PPR hole boundary.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Streamed on demand</p>
          </div>

          <Suspense fallback={<ReviewStatsSkeleton />}>
            <ReviewStatsHole getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>

          <div className="mt-8">
            <Suspense fallback={<ReviewsSkeleton />}>
              <ReviewsHole getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<RelatedProductsSkeleton />}>
          <RelatedProductsHole getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
        </Suspense>
      </div>
    </div>
  );
}

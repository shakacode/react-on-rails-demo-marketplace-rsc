import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { RelatedProducts } from './RelatedProducts';

interface RelatedProduct {
  id: number;
  name: string;
  price: number;
  original_price: number | null;
  category: string;
  brand: string;
  images: { url: string; alt: string; position: number }[];
  average_rating: number;
  review_count: number;
  in_stock: boolean;
  discount_percentage: number | null;
}

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

const CachedRelatedProducts = cacheComponent(
  async ({ products }: { products: RelatedProduct[] }) => <RelatedProducts products={products} />,
  { id: 'product-related', revalidate: 60 },
);

export default async function AsyncRelatedProductsRSC({ getReactOnRailsAsyncProp }: Props) {
  const data = await getReactOnRailsAsyncProp('related_products');

  return <CachedRelatedProducts products={data.products} />;
}

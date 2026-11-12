import React from 'react';
import { ProductCard } from '../../types/product';
import { StarRating } from './ProductInfo';

interface Props {
  products: ProductCard[];
}

export function RelatedProducts({ products }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-gray-200 pt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Customers Also Viewed</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all"
          >
            {/* Product image */}
            <div className="aspect-square bg-gray-50 overflow-hidden">
              <img
                src={product.images[0]?.url || '/seed-images/placeholder.svg'}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* Product info */}
            <div className="p-3.5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{product.brand}</p>
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">
                {product.name}
              </h3>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating rating={product.average_rating} size="sm" />
                <span className="text-xs text-gray-500">({product.review_count.toLocaleString('en-US')})</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
                {product.original_price && (
                  <span className="text-sm text-gray-400 line-through">${product.original_price.toFixed(2)}</span>
                )}
              </div>
              {!product.in_stock && (
                <span className="inline-block mt-1.5 text-xs text-red-600 font-medium">Out of stock</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

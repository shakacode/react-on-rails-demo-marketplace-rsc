import React from 'react';
import { Product } from '../../types/product';

interface Props {
  product: Product;
}

// Compact Unicode star rating — dramatically smaller RSC payload than inline SVGs.
// Each SVG star serializes to ~300 bytes in RSC flight format; Unicode text is ~10 bytes.
export function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.25;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div className={`flex items-center leading-none ${sizeClass}`} aria-label={`${rating} out of 5 stars`}>
      {fullStars > 0 && <span className="text-amber-400">{'★'.repeat(fullStars)}</span>}
      {hasHalf && (
        <span className="relative inline-block text-gray-200">
          ★
          <span className="absolute inset-0 overflow-hidden w-1/2 text-amber-400">★</span>
        </span>
      )}
      {emptyStars > 0 && <span className="text-gray-200">{'★'.repeat(emptyStars)}</span>}
    </div>
  );
}

export function ProductInfo({ product }: Props) {
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <span className="hover:text-gray-700 cursor-pointer">Home</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="hover:text-gray-700 cursor-pointer">{product.category}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">{product.brand}</span>
      </nav>

      {/* Brand */}
      <p className="text-sm font-medium text-indigo-600 uppercase tracking-wide">{product.brand}</p>

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

      {/* Rating summary */}
      <div className="flex items-center gap-3">
        <StarRating rating={product.average_rating} />
        <span className="text-sm font-semibold text-gray-900">{product.average_rating.toFixed(1)}</span>
        <span className="text-sm text-gray-500">({product.review_count.toLocaleString('en-US')} reviews)</span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
        {product.original_price && (
          <>
            <span className="text-lg text-gray-400 line-through">${product.original_price.toFixed(2)}</span>
            <span className="px-2.5 py-0.5 text-sm font-semibold text-red-700 bg-red-50 rounded-lg">
              {product.discount_percentage}% OFF
            </span>
          </>
        )}
      </div>

      {/* SKU */}
      <p className="text-xs text-gray-400">SKU: {product.sku}</p>
    </div>
  );
}

// SearchResultCard — renders a single product in the search results grid.
// In RSC: this is a server component — NO JS shipped for these cards.
//         AddToCartButton import becomes a client reference via RSC WebpackLoader.
// In SSR: this entire component + its rendering logic is hydrated on the client.

import React from 'react';
import { SearchProduct, ReviewSnippet } from './types';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { AddToCartButton, CardStarRating, CardReviewSnippets, CardFeaturesList, CardProductTags } from './SearchShell';

interface Props {
  product: SearchProduct;
  reviewSnippet?: ReviewSnippet;
  reviewSnippets?: ReviewSnippet[];
  description?: string;
  isCompareSelected?: boolean;
  onCompareToggle?: () => void;
  compareButton?: React.ReactNode;
  index?: number;
}

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function SearchResultCard({ product, reviewSnippet, reviewSnippets, description, isCompareSelected, onCompareToggle, compareButton, index }: Props) {
  const hasDiscount = product.discount_percentage && product.discount_percentage > 0;
  const imageUrl = product.images?.[0]?.url;
  const imageAlt = product.images?.[0]?.alt || product.name;

  // Use the array form if available (SSR sends multiple), otherwise single snippet (RSC)
  const snippets = reviewSnippets || (reviewSnippet ? [reviewSnippet] : []);

  // Above-the-fold images (first row of 3-column grid) load eagerly for LCP.
  // Below-the-fold images stay lazy to save bandwidth.
  const isAboveFold = index !== undefined && index < 3;

  // Render a truncated markdown description as HTML — this is expensive
  // In RSC: runs server-side (marked + highlight.js never shipped to client)
  // In SSR: marked + highlight.js shipped to client for hydration
  const descriptionHtml = description
    ? renderMarkdown(description.slice(0, 300))
    : '';

  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading={isAboveFold ? 'eager' : 'lazy'}
            {...(index === 0 ? { fetchPriority: 'high' } : {})}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            -{product.discount_percentage}%
          </div>
        )}

        {/* Out of stock overlay */}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Compare button — RSC passes a client component island via compareButton prop */}
        {compareButton}

        {/* Compare checkbox — rendered in SSR (interactive, needs hydration) */}
        {onCompareToggle && (
          <button
            onClick={(e) => { e.stopPropagation(); onCompareToggle(); }}
            className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isCompareSelected
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/80 text-gray-400 hover:bg-white hover:text-gray-600 shadow-sm'
            }`}
            title="Add to compare"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isCompareSelected ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-indigo-600 font-medium">{product.category}</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">{product.brand}</span>
        </div>

        {/* Product Name */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>

        {/* Rating — client component: sends 2 numbers instead of full element tree */}
        <CardStarRating rating={product.average_rating} count={product.review_count} />

        {/* Features — client component: sends string[] instead of full <ul>/<li> tree */}
        <CardFeaturesList features={product.features || []} />

        {/* Markdown description snippet (expensive to render) */}
        {descriptionHtml && (
          <div
            className="text-xs text-gray-500 line-clamp-2 mt-1 prose prose-xs"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {/* Review snippets — client component: sends ReviewSnippet[] data instead of full element tree */}
        <CardReviewSnippets snippets={snippets} />

        {/* Tags — client component: sends string[] instead of full <span> tree */}
        <CardProductTags tags={product.tags || []} />

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-auto pt-2 border-t border-gray-100">
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
          {product.in_stock && product.stock_quantity <= 10 && (
            <span className="text-xs text-orange-600 font-medium ml-auto">
              Only {product.stock_quantity} left
            </span>
          )}
        </div>

        {/* Add to Cart — the only interactive element per card.
            In RSC: only this tiny client component hydrates, zero JS for the rest.
            In SSR: hydrates along with the entire card. */}
        <AddToCartButton productId={product.id} inStock={product.in_stock} />
      </div>
    </div>
  );
}

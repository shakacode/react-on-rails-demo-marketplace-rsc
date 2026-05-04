// No 'use client' — this is a server component that awaits streamed search results.
// The SearchResultCard components are rendered server-side as pure HTML.
// No JS is shipped for the product cards themselves.
// Only the AddToCartButton and CompareButton (client components) hydrate per card.
//
// Now includes the same data as SSR for a fair comparison:
//   - 2 review snippets per product (same as SSR)
//   - Compare button on each card (same as SSR)
//   - Active filter pills (same as SSR)
//   - 500-char descriptions, 6 features, specs (same as SSR)

import React from 'react';
import type { SearchProduct, Pagination as PaginationType, ReviewSnippet } from './types';
import { SearchResultCard } from './SearchResultCard';
import { SearchShellSort, SearchShellPagination, CompareButton, SearchShellActiveFilters, AddToCartButton, CardStarRating, CardReviewSnippets, CardFeaturesList, CardProductTags } from './SearchShellForServer';
import { EmptySearchSuggestions, type EmptyStateSuggestions } from './EmptySearchSuggestions';

interface SearchResultsData {
  products: SearchProduct[];
  review_snippets: Record<number, ReviewSnippet[]>;
  pagination: PaginationType;
  meta: {
    query: string;
    sort: string;
    total_results: number;
    filters_applied: { type: string; value: string }[];
  };
  empty_suggestions?: EmptyStateSuggestions | null;
}

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncSearchResultsRSC({ getReactOnRailsAsyncProp }: Props) {
  const data: SearchResultsData = await getReactOnRailsAsyncProp('search_results');
  const { products, review_snippets, pagination, meta } = data;

  return (
    <div>
      {/* Active filter pills — client component wrapper */}
      <SearchShellActiveFilters filtersApplied={meta.filters_applied || []} />

      {/* Sort bar — client component wrapper (receives data, manages its own state) */}
      <SearchShellSort currentSort={meta.sort} totalResults={meta.total_results} />

      {products.length === 0 ? (
        data.empty_suggestions ? (
          <EmptySearchSuggestions
            query={meta.query}
            hasActiveFilters={(meta.filters_applied || []).length > 0}
            suggestions={data.empty_suggestions}
          />
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No products found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
          </div>
        )
      ) : (
        <>
          {/* Product grid — ALL cards are server-rendered HTML, zero JS hydration cost.
              Only the AddToCartButton and CompareButton (client components) hydrate per card. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product, idx) => (
              <SearchResultCard
                key={product.id}
                product={product}
                description={product.description}
                reviewSnippets={review_snippets[product.id]}
                compareButton={<CompareButton productId={product.id} />}
                addToCartButton={<AddToCartButton productId={product.id} inStock={product.in_stock} />}
                starRating={<CardStarRating rating={product.average_rating} count={product.review_count} />}
                reviewSnippetsNode={<CardReviewSnippets snippets={review_snippets[product.id] || []} />}
                featuresList={<CardFeaturesList features={product.features || []} />}
                productTags={<CardProductTags tags={product.tags || []} />}
                index={idx}
              />
            ))}
          </div>

          {/* Pagination — client component wrapper */}
          <SearchShellPagination pagination={pagination} />
        </>
      )}
    </div>
  );
}

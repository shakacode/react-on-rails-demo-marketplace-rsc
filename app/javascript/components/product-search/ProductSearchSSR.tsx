'use client';

// V1: Full SSR — ALL data fetched on server, returned at once.
// ALL component code + libraries (marked, highlight.js, star rendering, card layout)
// are shipped to the client for hydration.
// FCP/LCP blocked until ALL queries complete (products + facets + review snippets + tags).
// INP impacted because every result card is hydrated with interactive event handlers.
// 36 products per page with 3 reviews each = ~200+ hydrated interactive elements.

import React, { useState, useCallback } from 'react';
import type { SearchProduct, Facets, Pagination as PaginationType, ReviewSnippet, SearchMeta } from './types';
import { SearchResultCard } from './SearchResultCard';
import { AddToCartButton, CardStarRating, CardReviewSnippets, CardFeaturesList, CardProductTags } from './SearchShell';
import { FilterSidebar } from './FilterSidebar';
import { SortBar } from './SortBar';
import { SearchInput } from './SearchInput';
import { PaginationControls } from './PaginationControls';
import { ActiveFilterPills } from './ActiveFilterPills';
import { applySearchParams, type SearchParamUpdates } from './useSearchUrl';
import { EmptySearchSuggestions, type EmptyStateSuggestions } from './EmptySearchSuggestions';


interface BrandHighlight {
  name: string;
  product_count: number;
  avg_rating: number;
}

interface PopularTag {
  name: string;
  count: number;
}

interface Props {
  products: SearchProduct[];
  pagination: PaginationType;
  facets: Facets;
  search_meta: SearchMeta;
  descriptions: Record<number, string>;
  review_snippets: Record<number, ReviewSnippet[]>;
  popular_tags: PopularTag[];
  brand_highlights: BrandHighlight[];
  empty_suggestions?: EmptyStateSuggestions | null;
}

export default function ProductSearchSSR({
  products,
  pagination,
  facets,
  search_meta,
  descriptions,
  review_snippets,
  popular_tags,
  brand_highlights,
  empty_suggestions,
}: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [compareList, setCompareList] = useState<Set<number>>(new Set());

  const activeFiltersList = (search_meta.filters_applied || []).map((f) => ({
    type: f.type,
    value: f.value,
    label: f.type.charAt(0).toUpperCase() + f.type.slice(1).replace('_', ' '),
  }));

  const handleSearch = useCallback((q: string) => {
    applySearchParams({ q: q || undefined });
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    applySearchParams({ sort });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    applySearchParams({ page: String(page) });
  }, []);

  const handleFilterChange = useCallback((filters: Record<string, string | undefined>) => {
    applySearchParams(filters as SearchParamUpdates);
  }, []);

  const handleRemoveFilter = useCallback((type: string) => {
    if (type === 'price') {
      applySearchParams({ price_min: undefined, price_max: undefined });
    } else {
      applySearchParams({ [type as 'category']: undefined });
    }
  }, []);

  const handleClearAllFilters = useCallback(() => {
    applySearchParams({
      category: undefined,
      brand: undefined,
      min_rating: undefined,
      in_stock: undefined,
      price_min: undefined,
      price_max: undefined,
    });
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleCompareToggle = useCallback((productId: number) => {
    setCompareList((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else if (next.size < 4) next.add(productId);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Product Search</h1>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              V1: Full SSR — All data blocks response. marked + highlight.js (400KB+) shipped to client for hydration.
            </p>
          </div>
          <SearchInput
            initialQuery={search_meta.query}
            onSearch={handleSearch}
          />
        </div>
      </header>

      {/* Compare bar */}
      {compareList.size > 0 && (
        <div className="bg-indigo-600 text-white py-2 px-4 sticky top-[88px] z-20">
          <div className="container mx-auto max-w-7xl flex items-center justify-between">
            <span className="text-sm font-medium">
              {compareList.size} product{compareList.size > 1 ? 's' : ''} selected for comparison
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCompareList(new Set())}
                className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors"
              >
                Clear
              </button>
              <button className="text-xs bg-white text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full font-medium transition-colors">
                Compare Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        {/* Active filter pills */}
        <ActiveFilterPills
          filters={activeFiltersList}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-[140px] space-y-4">
              <FilterSidebar
                facets={facets}
                activeFilters={{
                  category: search_meta.filters_applied?.find((f) => f.type === 'category')?.value,
                  brand: search_meta.filters_applied?.find((f) => f.type === 'brand')?.value,
                  min_rating: search_meta.filters_applied?.find((f) => f.type === 'min_rating')?.value?.replace('+', ''),
                  in_stock: search_meta.filters_applied?.find((f) => f.type === 'in_stock') ? 'true' : undefined,
                }}
                onFilterChange={handleFilterChange}
              />

              {/* Popular Tags Cloud — interactive, needs hydration */}
              {popular_tags.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {popular_tags.map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => handleTagClick(tag.name)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                          selectedTags.has(tag.name)
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                        }`}
                      >
                        {tag.name}
                        <span className="ml-1 text-gray-400">({tag.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Highlights — interactive cards with hover state */}
              {brand_highlights.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Brands</h3>
                  <div className="space-y-2">
                    {brand_highlights.map((brand) => (
                      <button
                        key={brand.name}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{brand.name}</span>
                          <span className="text-xs text-gray-400">({brand.product_count})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-xs text-gray-600">{brand.avg_rating}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <SortBar
              currentSort={search_meta.sort}
              totalResults={search_meta.total_results}
              onSortChange={handleSortChange}
            />

            {products.length === 0 ? (
              empty_suggestions ? (
                <EmptySearchSuggestions
                  query={search_meta.query}
                  hasActiveFilters={(search_meta.filters_applied || []).length > 0}
                  suggestions={empty_suggestions}
                />
              ) : (
                <div className="text-center py-16">
                  <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                  <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {products.map((product, idx) => (
                    <SearchResultCard
                      key={product.id}
                      product={product}
                      description={descriptions[product.id]}
                      reviewSnippets={review_snippets[product.id]}
                      isCompareSelected={compareList.has(product.id)}
                      onCompareToggle={() => handleCompareToggle(product.id)}
                      addToCartButton={<AddToCartButton productId={product.id} inStock={product.in_stock} />}
                      starRating={<CardStarRating rating={product.average_rating} count={product.review_count} />}
                      reviewSnippetsNode={<CardReviewSnippets snippets={review_snippets[product.id] || []} />}
                      featuresList={<CardFeaturesList features={product.features || []} />}
                      productTags={<CardProductTags tags={product.tags || []} />}
                      index={idx}
                    />
                  ))}
                </div>

                <PaginationControls
                  pagination={pagination}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

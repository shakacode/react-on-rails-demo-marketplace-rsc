'use client';

// V2: Async content loader — fetches search results, facets, and review snippets via API.
// This component + all rendering libraries are loaded in an async chunk.

import React, { useState, useEffect, useCallback } from 'react';
import type { SearchProduct, Facets, Pagination as PaginationType, ReviewSnippet, SearchParams } from './types';
import { SearchResultCard } from './SearchResultCard';
import { FilterSidebar } from './FilterSidebar';
import { SortBar } from './SortBar';
import { PaginationControls } from './PaginationControls';
import { ResultsGridSkeleton } from './SearchSkeletons';
import { FilterSidebarSkeleton } from './SearchSkeletons';
import { applySearchParams, type SearchParamUpdates } from './useSearchUrl';

interface Props {
  searchParams: SearchParams;
}

export default function AsyncSearchContent({ searchParams }: Props) {
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [reviewSnippets, setReviewSnippets] = useState<Record<number, ReviewSnippet>>({});
  const [totalResults, setTotalResults] = useState(0);
  const [sort, setSort] = useState(searchParams.sort || 'relevance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          ...(searchParams.q && { q: searchParams.q }),
          ...(searchParams.category && { category: searchParams.category }),
          ...(searchParams.brand && { brand: searchParams.brand }),
          ...(searchParams.min_rating && { min_rating: searchParams.min_rating }),
          ...(searchParams.in_stock && { in_stock: searchParams.in_stock }),
          ...(searchParams.price_min && { price_min: searchParams.price_min }),
          ...(searchParams.price_max && { price_max: searchParams.price_max }),
          sort,
          page: searchParams.page || '1',
        });

        // Fetch results and facets in parallel
        const [resultsRes, facetsRes] = await Promise.all([
          fetch(`/api/product_search/results?${qs}`, { signal: controller.signal }),
          fetch(`/api/product_search/facets?${qs}`, { signal: controller.signal }),
        ]);

        const resultsData = await resultsRes.json();
        const facetsData = await facetsRes.json();

        setProducts(resultsData.products);
        setPagination(resultsData.pagination);
        setTotalResults(resultsData.meta.total_results);
        setFacets(facetsData.facets);

        // Fetch review snippets after results arrive
        if (resultsData.products.length > 0) {
          const productIds = resultsData.products.map((p: SearchProduct) => p.id);
          const snippetsRes = await fetch('/api/product_search/review_snippets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_ids: productIds }),
            signal: controller.signal,
          });
          const snippetsData = await snippetsRes.json();
          setReviewSnippets(snippetsData.snippets || {});
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Search fetch error:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [searchParams, sort]);

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-[140px]">
          {facets ? (
            <FilterSidebar
              facets={facets}
              activeFilters={{
                category: searchParams.category,
                brand: searchParams.brand,
                min_rating: searchParams.min_rating,
                in_stock: searchParams.in_stock,
                price_min: searchParams.price_min,
                price_max: searchParams.price_max,
              }}
              onFilterChange={(filters) => applySearchParams(filters as SearchParamUpdates)}
            />
          ) : (
            <FilterSidebarSkeleton />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-w-0">
        {loading ? (
          <ResultsGridSkeleton />
        ) : (
          <>
            <SortBar
              currentSort={sort}
              totalResults={totalResults}
              onSortChange={(next) => applySearchParams({ sort: next })}
            />

            {products.length === 0 ? (
              <div className="text-center py-16">
                <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {products.map((product, idx) => (
                    <SearchResultCard
                      key={product.id}
                      product={product}
                      description={product.description}
                      reviewSnippet={reviewSnippets[product.id]}
                      index={idx}
                    />
                  ))}
                </div>

                {pagination && (
                  <PaginationControls
                    pagination={pagination}
                    onPageChange={(page) => applySearchParams({ page: String(page) })}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

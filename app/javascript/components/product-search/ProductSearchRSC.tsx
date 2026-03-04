// No 'use client' — this is a server component (RSC bundle).
//
// V3: RSC Streaming — Search shell with input streams immediately.
// Results (with review snippets merged) and facets stream progressively.
// Popular tags and brand highlights stream as separate async props.
//
// Now includes ALL the same features as SSR for a fair comparison:
//   - Compare button per card (client component island)
//   - Compare bar at top (client component)
//   - Active filter pills (client component)
//   - Popular tags cloud (client component, streamed separately)
//   - Brand highlights (client component, streamed separately)
//   - 2 review snippets per product
//   - 500-char descriptions, 6 features, specs
//
// 4 streaming emits:
//   1. search_results (products + review_snippets + pagination + meta + filters)
//   2. facets (category/brand/price/rating aggregations)
//   3. popular_tags (tag cloud data)
//   4. brand_highlights (top brands with counts/ratings)
//
// Libraries that stay SERVER-SIDE (never shipped to browser):
//   - marked + highlight.js (~350KB) — used to render description markdown
//   - SearchResultCard rendering logic — all stays server-side
//   - Star rating computation, price formatting, feature lists
//
// Only shipped to client (interactive wrappers):
//   - SearchShellHeader (~2KB) — search bar
//   - SearchShellFilters (~4KB) — filter sidebar
//   - SearchShellSort (~1KB) — sort dropdown
//   - SearchShellPagination (~2KB) — page navigation
//   - CompareButton (~1KB) — compare toggle per card (client island)
//   - CompareBar (~1KB) — sticky compare bar
//   - SearchShellActiveFilters (~1KB) — active filter pills
//   - SearchShellTags (~1KB) — popular tags cloud
//   - SearchShellBrandHighlights (~1KB) — brand highlights
//
// Total JS savings: ~400KB+ eliminated from client bundle (marked + highlight.js).
// Result cards (the heaviest content) are pure HTML — zero hydration cost.

import React, { Suspense } from 'react';
import type { SearchParams } from './types';
import { SearchShellHeader, CompareBar } from './SearchShell';
import AsyncSearchResultsRSC from './AsyncSearchResultsRSC';
import AsyncFacetsRSC from './AsyncFacetsRSC';
import AsyncSidebarExtrasRSC from './AsyncSidebarExtrasRSC';
import { ResultsGridSkeleton } from './SearchSkeletons';
import { FilterSidebarSkeleton } from './SearchSkeletons';

interface Props {
  search_params: SearchParams;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default function ProductSearchRSC({ search_params, getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — streams immediately with search input */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Product Search</h1>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              V3: RSC Streaming — Result cards rendered server-side (0KB JS). Only filters + search are interactive.
            </p>
          </div>
          <SearchShellHeader initialQuery={search_params.q || ''} />
        </div>
      </header>

      {/* Compare bar — client component, shared state across CompareButton islands */}
      <CompareBar />

      {/* Main content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar — facets stream from server, then tags and brand highlights */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-[140px] space-y-4">
              <Suspense fallback={<FilterSidebarSkeleton />}>
                <AsyncFacetsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
              </Suspense>

              {/* Popular tags + Brand highlights stream as separate async props */}
              <Suspense fallback={null}>
                <AsyncSidebarExtrasRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
              </Suspense>
            </div>
          </div>

          {/* Results area — product cards stream as server-rendered HTML */}
          <div className="flex-1 min-w-0">
            <Suspense fallback={<ResultsGridSkeleton />}>
              <AsyncSearchResultsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
            </Suspense>
          </div>
        </div>
      </div>

    </div>
  );
}

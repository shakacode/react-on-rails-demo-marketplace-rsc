'use client';

// V2: Client Components — basic search shell SSRed, data fetched via API.
// Libraries are loaded in async chunks after initial page load.
// Multiple API round-trips for results, facets, and review snippets.

import React from 'react';
import loadable from '@loadable/component';
import type { SearchParams } from './types';
import { SearchInput } from './SearchInput';
import { applySearchParams } from './useSearchUrl';

import { ResultsGridSkeleton } from './SearchSkeletons';
import { FilterSidebarSkeleton } from './SearchSkeletons';

const AsyncSearchContent = loadable(
  () => import('./AsyncSearchContent'),
  {
    fallback: (
      <div className="flex gap-6">
        <div className="hidden lg:block w-64 flex-shrink-0">
          <FilterSidebarSkeleton />
        </div>
        <div className="flex-1">
          <ResultsGridSkeleton />
        </div>
      </div>
    ),
  }
);

interface Props {
  search_params: SearchParams;
}

export default function ProductSearchClient({ search_params }: Props) {
  const handleSearch = (q: string) => {
    applySearchParams({ q: q || undefined });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Product Search</h1>
            <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              V2: Client Components — <strong>loadable()</strong> chunk fetched after page load. Filters/results re-fetched via API.
            </p>
          </div>
          <SearchInput
            initialQuery={search_params.q || ''}
            onSearch={handleSearch}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <AsyncSearchContent searchParams={search_params} />
      </div>

    </div>
  );
}

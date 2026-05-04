// No 'use client' — server component. Pure HTML, no event handlers.

import React from 'react';

export interface EmptyStateSuggestions {
  top_categories: { name: string; count: number }[];
  top_brands: { name: string; count: number }[];
  popular_searches?: string[];
}

interface Props {
  query: string;
  hasActiveFilters: boolean;
  suggestions: EmptyStateSuggestions;
}

function clearAllUrl(): string {
  if (typeof window === 'undefined') return '?';
  const url = new URL(window.location.href);
  ['category', 'brand', 'min_rating', 'in_stock', 'price_min', 'price_max'].forEach((k) => url.searchParams.delete(k));
  return url.pathname + (url.search ? url.search : '');
}

export function EmptySearchSuggestions({ query, hasActiveFilters, suggestions }: Props) {
  return (
    <div className="text-center py-16 px-4">
      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
      <p className="text-sm text-gray-500 mb-6">
        {query ? <>No matches for <span className="font-medium text-gray-700">&ldquo;{query}&rdquo;</span>.</> : 'No products match the current filters.'}
      </p>

      {hasActiveFilters && (
        <p className="text-sm mb-8">
          <a href="?" className="text-indigo-600 font-medium hover:underline">Clear all filters</a>
          {query && <> &middot; <a href="?" className="text-indigo-600 font-medium hover:underline">Reset search</a></>}
        </p>
      )}

      {suggestions.top_categories.length > 0 && (
        <div className="max-w-md mx-auto mb-6 text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Browse popular categories</p>
          <ul className="grid grid-cols-2 gap-2">
            {suggestions.top_categories.slice(0, 6).map((c) => (
              <li key={c.name}>
                <a
                  href={`?category=${encodeURIComponent(c.name)}`}
                  className="block bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                >
                  {c.name}
                  <span className="ml-2 text-xs text-slate-400">({c.count})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.top_brands.length > 0 && (
        <div className="max-w-md mx-auto text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Or shop popular brands</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.top_brands.slice(0, 8).map((b) => (
              <li key={b.name}>
                <a
                  href={`?brand=${encodeURIComponent(b.name)}`}
                  className="inline-block bg-white border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                >
                  {b.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

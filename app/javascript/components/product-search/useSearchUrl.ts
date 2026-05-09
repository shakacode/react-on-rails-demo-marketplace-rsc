'use client';

// Helper for SSR + RSC variants: full-page navigation rewrites the URL,
// so the Rails controller re-runs with the new params on the server.

const PARAM_KEYS = ['q', 'category', 'brand', 'min_rating', 'in_stock', 'price_min', 'price_max', 'sort', 'page'] as const;
type SearchParamKey = (typeof PARAM_KEYS)[number];

export type SearchParamUpdates = Partial<Record<SearchParamKey, string | undefined | null>>;

export function applySearchParams(updates: SearchParamUpdates) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  if (!('page' in updates)) {
    // Reset to page 1 whenever the query/filter/sort changes.
    url.searchParams.delete('page');
  }
  window.location.assign(url.pathname + (url.search ? url.search : ''));
}

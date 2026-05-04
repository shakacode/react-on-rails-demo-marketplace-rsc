// No 'use client' — pure server component. Each pill is an <a> link.
// Preserves the current ?q= so filtering by cuisine/city stacks with search.

import React from 'react';

export interface RestaurantFacets {
  cuisines: { name: string; count: number }[];
  cities: { name: string; count: number }[];
}

interface Props {
  facets: RestaurantFacets;
  query: string;
  cuisine?: string;
  city?: string;
}

function buildHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) search.set(key, value);
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '?';
}

export function RestaurantFacetLinks({ facets, query, cuisine, city }: Props) {
  if (facets.cuisines.length === 0 && facets.cities.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid gap-4 md:grid-cols-2">
      {facets.cuisines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by cuisine</p>
          <div className="flex flex-wrap gap-1.5">
            <a
              href={buildHref({ q: query })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                !cuisine
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200'
              }`}
            >
              All cuisines
            </a>
            {facets.cuisines.map((c) => (
              <a
                key={c.name}
                href={buildHref({ q: query, cuisine: c.name, city })}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  cuisine === c.name
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200'
                }`}
              >
                {c.name}
                <span className="ml-1 text-slate-400">({c.count})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {facets.cities.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by city</p>
          <div className="flex flex-wrap gap-1.5">
            <a
              href={buildHref({ q: query, cuisine })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                !city
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200'
              }`}
            >
              All cities
            </a>
            {facets.cities.map((c) => (
              <a
                key={c.name}
                href={buildHref({ q: query, cuisine, city: c.name })}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  city === c.name
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200'
                }`}
              >
                {c.name}
                <span className="ml-1 text-slate-400">({c.count})</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

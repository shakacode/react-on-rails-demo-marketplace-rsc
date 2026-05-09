// No 'use client' — server component that awaits streamed facet data.
// Only the SearchShellFilters interactive wrapper is a client component.

import React from 'react';
import type { Facets, SearchParams } from './types';
import { SearchShellFilters } from './SearchShellForServer';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
  searchParams?: SearchParams;
}

export default async function AsyncFacetsRSC({ getReactOnRailsAsyncProp, searchParams }: Props) {
  const facets: Facets = await getReactOnRailsAsyncProp('facets');

  const activeFilters = {
    category: searchParams?.category,
    brand: searchParams?.brand,
    min_rating: searchParams?.min_rating,
    in_stock: searchParams?.in_stock,
    price_min: searchParams?.price_min,
    price_max: searchParams?.price_max,
  };

  return <SearchShellFilters facets={facets} activeFilters={activeFilters} />;
}

// No 'use client' — server component that awaits streamed facet data.
// Only the SearchShellFilters interactive wrapper is a client component.

import React from 'react';
import type { Facets } from './types';
import { SearchShellFilters } from './SearchShellForServer';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncFacetsRSC({ getReactOnRailsAsyncProp }: Props) {
  const facets: Facets = await getReactOnRailsAsyncProp('facets');

  return <SearchShellFilters facets={facets} />;
}

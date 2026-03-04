// No 'use client' — server component that awaits streamed popular tags and brand highlights.
// These are additional sidebar sections that stream after the main facets.

import React from 'react';
import { SearchShellTags, SearchShellBrandHighlights } from './SearchShell';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncSidebarExtrasRSC({ getReactOnRailsAsyncProp }: Props) {
  const [popularTags, brandHighlights] = await Promise.all([
    getReactOnRailsAsyncProp('popular_tags'),
    getReactOnRailsAsyncProp('brand_highlights'),
  ]);

  return (
    <>
      <SearchShellTags tags={popularTags} />
      <SearchShellBrandHighlights brands={brandHighlights} />
    </>
  );
}

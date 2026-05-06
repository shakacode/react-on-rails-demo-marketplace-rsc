'use client';

import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChunkExtractor } from '@loadable/server';
import SearchPageClient from '../components/search/SearchPageClient';

const serverApp = (props: Record<string, unknown>, _railsContext: Record<string, unknown>) => {
  // entrypoints: [] — see BlogPostClient.server.tsx for the rationale.
  const statsFile = path.resolve(__dirname, 'loadable-stats.json');
  const extractor = new ChunkExtractor({ entrypoints: [], statsFile });

  const componentHtml = renderToString(
    extractor.collectChunks(<SearchPageClient {...props as any} />)
  );

  return {
    renderedHtml: {
      componentHtml,
      linkTags: extractor.getLinkTags(),
      styleTags: extractor.getStyleTags(),
      scriptTags: extractor.getScriptTags(),
    },
  };
};

export default serverApp;

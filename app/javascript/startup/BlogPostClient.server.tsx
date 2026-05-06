'use client';

import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChunkExtractor } from '@loadable/server';
import BlogPostClient from '../components/blog/BlogPostClient';

const serverApp = (props: Record<string, unknown>, _railsContext: Record<string, unknown>) => {
  // React on Rails Pro copies loadable-stats.json to the same directory as server-bundle.js.
  // entrypoints: [] keeps ChunkExtractor from emitting the client-bundle entry's static chunks
  // (runtime, vendor, client-bundle itself) — those are already loaded by the layout's
  // <%= javascript_pack_tag 'client-bundle' %>. Without this, the entry's runtime + vendor
  // chunks would appear as <script> tags in both <head> (from getScriptTags) and end-of-body
  // (from the layout pack tag), creating two webpack runtimes and tripping react-on-rails
  // v16.6's "already initialized by another bundle" guard. We still need ChunkExtractor for
  // collectChunks + the __LOADABLE_REQUIRED_CHUNKS__ handshake, both of which only depend on
  // dynamically discovered chunks (this.chunks), independent of `entrypoints`.
  const statsFile = path.resolve(__dirname, 'loadable-stats.json');
  const extractor = new ChunkExtractor({ entrypoints: [], statsFile });

  const componentHtml = renderToString(
    extractor.collectChunks(<BlogPostClient {...props as any} />)
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

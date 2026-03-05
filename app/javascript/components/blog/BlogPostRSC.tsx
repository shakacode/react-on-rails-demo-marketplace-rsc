// No "use client" — this is a server component (RSC bundle)

import React, { Suspense } from 'react';
import { BlogPost } from '../../types/blog';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { BlogPostHeader } from './BlogPostHeader';
import { BookmarkShareBar } from './BookmarkShareBarForServer';
import { TableOfContents } from './TableOfContentsForServer';
import { ReadingModeToggle } from './ReadingModeToggleForServer';
import { InteractiveSection } from './InteractiveSectionForServer';
import { INPOverlay } from './INPOverlayForServer';
import { RelatedPostsSkeleton } from './RelatedPostsSkeleton';
import AsyncRelatedPostsRSC from './AsyncRelatedPostsRSC';

// Sync props only contain small metadata (~1.5KB), not the heavy content (~25KB).
// This keeps the RSC cache key, init script, and hydration props small.
interface Props {
  post: Omit<BlogPost, 'content'>;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

function ArticleSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
      ))}
    </div>
  );
}

async function ArticleBodyRSC({ getReactOnRailsAsyncProp }: { getReactOnRailsAsyncProp: (name: string) => Promise<any> }) {
  // Yield to the event loop so React flushes the header HTML first.
  // Without this, the emit.call data may already be available (it fires immediately
  // in the Rails background thread), and React would render the article inline
  // without triggering Suspense — defeating progressive rendering.
  await new Promise<void>((r) => setTimeout(r, 0));
  const { content } = await getReactOnRailsAsyncProp('post_content');
  const html = renderMarkdown(content);
  return (
    <article
      className="prose prose-lg max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function BlogPostRSC({ post, getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-6">
        V3: RSC Streaming — marked + highlight.js stay server-side, 0KB to client
      </p>

      <BookmarkShareBar />

      <BlogPostHeader post={post as BlogPost} />

      <ReadingModeToggle />

      <TableOfContents entries={post.toc_entries} />

      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleBodyRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
      </Suspense>

      <InteractiveSection />

      <Suspense fallback={<RelatedPostsSkeleton />}>
        <AsyncRelatedPostsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
      </Suspense>

      <INPOverlay />
    </div>
  );
}

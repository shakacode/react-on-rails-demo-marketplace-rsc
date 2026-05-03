// No "use client" — this is a server component (RSC bundle)

import React from 'react';
import { BlogPost, RelatedPost } from '../../types/blog';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { BlogPostHeader } from './BlogPostHeader';
import { RelatedPosts } from './RelatedPosts';
import { BookmarkShareBar } from './BookmarkShareBarForServer';
import { TableOfContents } from './TableOfContentsForServer';
import { ReadingModeToggle } from './ReadingModeToggleForServer';
import { InteractiveSection } from './InteractiveSectionForServer';

interface Props {
  post: BlogPost;
  related_posts: RelatedPost[];
}

export default function BlogPostRSCSimple({ post, related_posts }: Props) {
  const html = renderMarkdown(post.content);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-6">
        V4: RSC Simple — marked + highlight.js stay server-side, all data passed upfront (no streaming)
      </p>

      <BookmarkShareBar />

      <BlogPostHeader post={post} />

      <ReadingModeToggle />

      <TableOfContents entries={post.toc_entries} />

      <article
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <InteractiveSection />

      <RelatedPosts posts={related_posts} />

    </div>
  );
}

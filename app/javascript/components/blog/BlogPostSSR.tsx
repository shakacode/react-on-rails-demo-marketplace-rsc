'use client';

import React from 'react';
import { BlogPost, RelatedPost } from '../../types/blog';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { BlogPostHeader } from './BlogPostHeader';
import { RelatedPosts } from './RelatedPosts';
import { BookmarkShareBar } from './BookmarkShareBar';
import { TableOfContents } from './TableOfContents';
import { ReadingModeToggle } from './ReadingModeToggle';
import { InteractiveSection } from './InteractiveSection';

interface Props {
  post: BlogPost;
  related_posts: RelatedPost[];
}

export default function BlogPostSSR({ post, related_posts }: Props) {
  const html = renderMarkdown(post.content);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6">
        V1: Full SSR — marked + highlight.js (350KB+) shipped to client for hydration
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

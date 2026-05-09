'use client';

import React from 'react';
import loadable from '@loadable/component';
import { BlogPost } from '../../types/blog';
import { BlogPostHeader } from './BlogPostHeader';
import { BlogContentSkeleton } from './BlogContentSkeleton';
import { BookmarkShareBar } from './BookmarkShareBar';
import { TableOfContents } from './TableOfContents';
import { ReadingModeToggle } from './ReadingModeToggle';
import { InteractiveSection } from './InteractiveSection';

const AsyncBlogContent = loadable(
  () => import('./AsyncBlogContent'),
  { fallback: <BlogContentSkeleton /> }
);

interface Props {
  post: BlogPost;
}

export default function BlogPostClient({ post }: Props) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
        V2: Client Components — <code className="bg-white/60 px-1 rounded">@loadable/component</code> loads <code className="bg-white/60 px-1 rounded">AsyncBlogContent</code> (markdown + highlight.js) in a separate chunk after the shell hydrates.
      </p>

      <BookmarkShareBar />

      <BlogPostHeader post={post} />

      <ReadingModeToggle />

      <TableOfContents entries={post.toc_entries} />

      <AsyncBlogContent postId={post.id} content={post.content} />

      <InteractiveSection />

    </div>
  );
}

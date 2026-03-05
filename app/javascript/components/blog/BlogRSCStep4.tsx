// No "use client" — server component
// Step 4: Import `marked` directly (no highlight.js)

import React from 'react';
import { Marked } from 'marked';
import { BlogPost } from '../../types/blog';
import { BlogPostHeader } from './BlogPostHeader';
import { InteractiveSection } from './InteractiveSectionForServer';

const marked = new Marked();

interface Props {
  post: BlogPost;
}

export default function BlogRSCStep4({ post }: Props) {
  const html = marked.parse(post.content) as string;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
        RSC Step 4: Server component + marked (no highlight.js)
      </p>
      <BlogPostHeader post={post} />
      <article
        className="prose prose-lg max-w-none mt-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <InteractiveSection />
    </div>
  );
}

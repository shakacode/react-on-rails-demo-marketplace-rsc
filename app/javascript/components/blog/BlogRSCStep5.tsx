// No "use client" — server component
// Step 5: Import full renderMarkdown (marked + highlight.js)

import React from 'react';
import { BlogPost } from '../../types/blog';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { BlogPostHeader } from './BlogPostHeader';
import { InteractiveSection } from './InteractiveSectionForServer';

interface Props {
  post: BlogPost;
}

export default function BlogRSCStep5({ post }: Props) {
  const html = renderMarkdown(post.content);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
        RSC Step 5: Server component + marked + highlight.js (full renderMarkdown)
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

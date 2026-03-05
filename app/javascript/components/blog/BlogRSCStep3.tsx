// No "use client" — server component
// Step 3: Import a 'use client' component (InteractiveSection) — tests client reference boundary

import React from 'react';
import { BlogPost } from '../../types/blog';
import { BlogPostHeader } from './BlogPostHeader';
import { InteractiveSection } from './InteractiveSectionForServer';

interface Props {
  post: BlogPost;
}

export default function BlogRSCStep3({ post }: Props) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
        RSC Step 3: Server component + 'use client' component (InteractiveSection)
      </p>
      <BlogPostHeader post={post} />
      <p className="text-gray-600 mt-4">Post content would go here.</p>
      <InteractiveSection />
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { RelatedPost } from '../../types/blog';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { RelatedPosts } from './RelatedPosts';
import { RelatedPostsSkeleton } from './RelatedPostsSkeleton';
import { appendDelay } from '../../utils/delayParam';

interface Props {
  postId: number;
  content: string;
}

export default function AsyncBlogContent({ postId, content }: Props) {
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[] | null>(null);

  const html = renderMarkdown(content);

  useEffect(() => {
    const controller = new AbortController();

    fetch(appendDelay(`/api/blog_posts/${postId}/related_posts`), { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setRelatedPosts(data.posts))
      .catch(() => {});

    return () => controller.abort();
  }, [postId]);

  return (
    <>
      <article
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {relatedPosts ? (
        <RelatedPosts posts={relatedPosts} />
      ) : (
        <RelatedPostsSkeleton />
      )}
    </>
  );
}

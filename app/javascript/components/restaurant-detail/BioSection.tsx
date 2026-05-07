// 'use client' counterpart — same JSX as BioSectionForServer; the directive
// is what causes marked + highlight.js + sanitize-html to ship to the
// browser on SSR/Client variants.
'use client';

import React from 'react';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';
import { DetailRestaurant } from './types';

interface Props {
  bio: string;
  story: string;
  restaurant: DetailRestaurant;
}

export function BioSection({ bio, story, restaurant }: Props) {
  const bioHtml = renderSanitizedMarkdown(bio);
  const storyHtml = renderSanitizedMarkdown(story);
  const photo = restaurant.image_url
    ? restaurant.image_url.replace(/\d+\/\d+$/, '800/600')
    : `https://picsum.photos/seed/restaurant-${restaurant.id}-bio/800/600`;
  return (
    <section className="container mx-auto px-4 mb-14">
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <article
          className="prose prose-slate max-w-none lg:col-span-2 prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-0 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-blockquote:border-amber-400 prose-blockquote:bg-amber-50 prose-blockquote:not-italic prose-blockquote:rounded-md prose-blockquote:py-1 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none"
          dangerouslySetInnerHTML={{ __html: bioHtml }}
        />
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-2xl shadow-md">
            <img
              src={photo}
              alt={restaurant.name}
              loading="lazy"
              className="w-full h-56 object-cover"
            />
          </div>
          <div
            className="prose prose-slate prose-sm max-w-none rounded-2xl border border-slate-200 bg-white p-5 shadow-sm prose-h3:text-base prose-h3:font-semibold prose-h3:mt-0 prose-h3:mb-2"
            dangerouslySetInnerHTML={{ __html: storyHtml }}
          />
        </aside>
      </div>
    </section>
  );
}

// 'use client' — entire page tree is client-rendered (and SSRed via the
// server-bundle). Section children are the regular 'use client' versions.
'use client';

import React from 'react';
import { RestaurantDetailProps } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSection';
import { MenuSection } from './MenuSection';
import { ReviewsSection } from './ReviewsSection';
import { SidebarSection } from './SidebarSection';

export default function RestaurantDetailSSR(props: RestaurantDetailProps) {
  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={props.restaurant} stats={props.stats} hours={props.hours} variant="ssr" />
      <BioSection bio={props.bio} story={props.story} restaurant={props.restaurant} />
      <MenuSection menu={props.menu} />
      <ReviewsSection reviews={props.reviews} averageRating={props.restaurant.average_rating} reviewCount={props.restaurant.review_count} />
      <SidebarSection neighborhood={props.neighborhood} faq={props.faq} hours={props.hours} restaurant={props.restaurant} />
    </div>
  );
}

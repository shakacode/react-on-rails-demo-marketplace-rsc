// No 'use client' — server component. All section children are *ForServer
// versions, so marked / highlight.js / sanitize-html / intl-messageformat
// run on the server only and ship nothing to the browser.
import React from 'react';
import { RestaurantDetailProps } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSectionForServer';
import { MenuSection } from './MenuSectionForServer';
import { ReviewsSection } from './ReviewsSectionForServer';
import { SidebarSection } from './SidebarSectionForServer';

export default function RestaurantDetailRSC(props: RestaurantDetailProps) {
  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={props.restaurant} stats={props.stats} hours={props.hours} variant="rsc" />
      <BioSection bio={props.bio} story={props.story} restaurant={props.restaurant} />
      <MenuSection menu={props.menu} />
      <ReviewsSection reviews={props.reviews} averageRating={props.restaurant.average_rating} reviewCount={props.restaurant.review_count} />
      <SidebarSection neighborhood={props.neighborhood} faq={props.faq} hours={props.hours} restaurant={props.restaurant} />
    </div>
  );
}

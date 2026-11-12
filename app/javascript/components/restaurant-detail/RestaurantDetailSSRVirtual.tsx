// 'use client' — virtualized sibling of RestaurantDetailSSR (issue #184,
// Shape A). Identical tree except the reviews section, which mounts through
// react-virtuoso. Markdown still renders in the browser, as on /ssr.
'use client';

import React from 'react';
import { RestaurantDetailVirtualProps } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSection';
import { MenuSection } from './MenuSection';
import { ReviewsSectionVirtual } from './ReviewsSectionVirtual';
import { SidebarSection } from './SidebarSection';

export default function RestaurantDetailSSRVirtual(props: RestaurantDetailVirtualProps) {
  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={props.restaurant} stats={props.stats} hours={props.hours} variant="ssr-virtual" />
      <BioSection bio={props.bio} story={props.story} restaurant={props.restaurant} />
      <MenuSection menu={props.menu} />
      <ReviewsSectionVirtual
        reviews={props.reviews}
        averageRating={props.restaurant.average_rating}
        reviewCount={props.restaurant.review_count}
        virtualization={props.virtualization}
      />
      <SidebarSection neighborhood={props.neighborhood} faq={props.faq} hours={props.hours} restaurant={props.restaurant} />
    </div>
  );
}

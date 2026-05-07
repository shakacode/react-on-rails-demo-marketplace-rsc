// 'use client' — V2 client variant. The Rails view sends a small props bundle
// (just the restaurant id + cuisine) and this component fetches the heavy
// content from /api/restaurants/:id/detail after mount.
'use client';

import React, { useEffect, useState } from 'react';
import { RestaurantDetailProps } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSection';
import { MenuSection } from './MenuSection';
import { ReviewsSection } from './ReviewsSection';
import { SidebarSection } from './SidebarSection';

interface ClientProps {
  restaurant: RestaurantDetailProps['restaurant'];
}

const EMPTY_HOURS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  .map((day) => ({ day, open: null, close: null, closed: false }));

export default function RestaurantDetailClient({ restaurant }: ClientProps) {
  const [data, setData] = useState<RestaurantDetailProps | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/restaurants/${restaurant.id}/detail`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: RestaurantDetailProps) => setData(d))
      .catch(() => undefined);
    return () => controller.abort();
  }, [restaurant.id]);

  if (!data) {
    const placeholderStats = {
      avg_party_size: 0, tables: 0, menu_items_count: 0, reviews_count: 0,
      years_open: 0, staff_count: 0, seasonal_menu_changes_per_year: 0,
    };
    return (
      <div className="bg-slate-50 min-h-screen">
        <RestaurantHeader restaurant={restaurant} stats={placeholderStats} hours={EMPTY_HOURS} variant="client" />
        <div className="container mx-auto px-4 py-20 text-center text-slate-500">
          Loading restaurant detail…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={data.restaurant} stats={data.stats} hours={data.hours} variant="client" />
      <BioSection bio={data.bio} story={data.story} restaurant={data.restaurant} />
      <MenuSection menu={data.menu} />
      <ReviewsSection reviews={data.reviews} averageRating={data.restaurant.average_rating} reviewCount={data.restaurant.review_count} />
      <SidebarSection neighborhood={data.neighborhood} faq={data.faq} hours={data.hours} restaurant={data.restaurant} />
    </div>
  );
}

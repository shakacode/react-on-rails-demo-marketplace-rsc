// Virtualized sibling of RestaurantDetailRSC (issue #184, Shape B). Identical
// server-component tree except the reviews section: every card is still
// rendered server-side (marked/hljs/sanitize-html stay server-only), but the
// element rows cross the RSC boundary into a react-virtuoso client wrapper
// that mounts only the visible window.
import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { RestaurantDetailVirtualProps, MenuPayload, Review, HoursEntry, DetailRestaurant, VirtualizationConfig } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSectionForServer';
import { MenuSection } from './MenuSectionForServer';
import { ReviewsSectionVirtual } from './ReviewsSectionVirtualForServer';
import { SidebarSection } from './SidebarSectionForServer';

const CachedBioSection = cacheComponent(
  async ({ bio, story, restaurant }: { restaurantId: number; bio: string; story: string; restaurant: DetailRestaurant }) => (
    <BioSection bio={bio} story={story} restaurant={restaurant} />
  ),
  { id: 'restaurant-bio', revalidate: 60 },
);

const CachedMenuSection = cacheComponent(
  async ({ menu }: { restaurantId: number; menu: MenuPayload }) => <MenuSection menu={menu} />,
  { id: 'restaurant-menu', revalidate: 60 },
);

const CachedReviewsSectionVirtual = cacheComponent(
  async ({ reviews, averageRating, reviewCount, virtualization }: {
    restaurantId: number;
    reviews: Review[];
    averageRating: number;
    reviewCount: number;
    virtualization: VirtualizationConfig;
  }) => (
    <ReviewsSectionVirtual reviews={reviews} averageRating={averageRating} reviewCount={reviewCount} virtualization={virtualization} />
  ),
  { id: 'restaurant-reviews-virtual', revalidate: 60 },
);

const CachedSidebarSection = cacheComponent(
  async ({ neighborhood, faq, hours, restaurant }: { restaurantId: number; neighborhood: string; faq: string; hours: HoursEntry[]; restaurant: DetailRestaurant }) => (
    <SidebarSection neighborhood={neighborhood} faq={faq} hours={hours} restaurant={restaurant} />
  ),
  { id: 'restaurant-sidebar', revalidate: 60 },
);

export default function RestaurantDetailRSCVirtual(props: RestaurantDetailVirtualProps) {
  const rid = props.restaurant.id;
  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={props.restaurant} stats={props.stats} hours={props.hours} variant="rsc-virtual" />
      <CachedBioSection restaurantId={rid} bio={props.bio} story={props.story} restaurant={props.restaurant} />
      <CachedMenuSection restaurantId={rid} menu={props.menu} />
      <CachedReviewsSectionVirtual
        restaurantId={rid}
        reviews={props.reviews}
        averageRating={props.restaurant.average_rating}
        reviewCount={props.restaurant.review_count}
        virtualization={props.virtualization}
      />
      <CachedSidebarSection restaurantId={rid} neighborhood={props.neighborhood} faq={props.faq} hours={props.hours} restaurant={props.restaurant} />
    </div>
  );
}

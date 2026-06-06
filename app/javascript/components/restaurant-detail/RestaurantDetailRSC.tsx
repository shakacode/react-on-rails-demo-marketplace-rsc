import React from 'react';
import { cacheComponent } from '../../utils/rscCache';
import { RestaurantDetailProps, MenuPayload, Review, HoursEntry, DetailRestaurant } from './types';
import { RestaurantHeader } from './RestaurantHeader';
import { BioSection } from './BioSectionForServer';
import { MenuSection } from './MenuSectionForServer';
import { ReviewsSection } from './ReviewsSectionForServer';
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

const CachedReviewsSection = cacheComponent(
  async ({ reviews, averageRating, reviewCount }: { restaurantId: number; reviews: Review[]; averageRating: number; reviewCount: number }) => (
    <ReviewsSection reviews={reviews} averageRating={averageRating} reviewCount={reviewCount} />
  ),
  { id: 'restaurant-reviews', revalidate: 60 },
);

const CachedSidebarSection = cacheComponent(
  async ({ neighborhood, faq, hours, restaurant }: { restaurantId: number; neighborhood: string; faq: string; hours: HoursEntry[]; restaurant: DetailRestaurant }) => (
    <SidebarSection neighborhood={neighborhood} faq={faq} hours={hours} restaurant={restaurant} />
  ),
  { id: 'restaurant-sidebar', revalidate: 60 },
);

export default function RestaurantDetailRSC(props: RestaurantDetailProps) {
  const rid = props.restaurant.id;
  return (
    <div className="bg-slate-50 min-h-screen">
      <RestaurantHeader restaurant={props.restaurant} stats={props.stats} hours={props.hours} variant="rsc" />
      <CachedBioSection restaurantId={rid} bio={props.bio} story={props.story} restaurant={props.restaurant} />
      <CachedMenuSection restaurantId={rid} menu={props.menu} />
      <CachedReviewsSection restaurantId={rid} reviews={props.reviews} averageRating={props.restaurant.average_rating} reviewCount={props.restaurant.review_count} />
      <CachedSidebarSection restaurantId={rid} neighborhood={props.neighborhood} faq={props.faq} hours={props.hours} restaurant={props.restaurant} />
    </div>
  );
}

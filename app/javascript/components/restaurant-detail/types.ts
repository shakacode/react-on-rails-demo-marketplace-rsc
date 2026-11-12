// Type-only file — TS types are erased at compile time, so this file is safe
// to import from any tree (RSC, SSR, Client) without 'use client' concerns.

export interface DetailRestaurant {
  id: number;
  name: string;
  cuisine_type: string;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  average_rating: number;
  review_count: number;
  timezone: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price_usd: number;
  description: string;
  tags: string[];
  spice_level: number;
  calories: number;
  prep_minutes: number;
  pairings: string[];
}

export interface MenuPayload {
  categories: string[];
  items: MenuItem[];
}

export interface Review {
  id: number;
  reviewer: string;
  rating: number;
  title: string;
  body: string;
  helpful_count: number;
  verified: boolean;
  created_at: string;
}

export interface HoursEntry {
  day: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface RestaurantStats {
  avg_party_size: number;
  tables: number;
  menu_items_count: number;
  reviews_count: number;
  years_open: number;
  staff_count: number;
  seasonal_menu_changes_per_year: number;
}

// Extra knobs for the virtualized review-list variants (issue #184).
export interface VirtualizationConfig {
  // Rows (of two review cards) rendered into the server HTML — Virtuoso's
  // initialItemCount. 0 = no server-rendered rows (the no-JS/SEO preview lane).
  initial_rows: number;
}

export interface RestaurantDetailProps {
  restaurant: DetailRestaurant;
  bio: string;
  story: string;
  menu: MenuPayload;
  reviews: Review[];
  hours: HoursEntry[];
  faq: string;
  neighborhood: string;
  currencies: string[];
  currency_rates: Record<string, number>;
  stats: RestaurantStats;
}

export interface RestaurantDetailVirtualProps extends RestaurantDetailProps {
  virtualization: VirtualizationConfig;
}

# Task 3: Traditional Versions (V1 + V2)

> **Historical planning document.** This is the original proposal, not current operating instructions or a record of what shipped. Routes, commands, dataset sizes, performance targets, and checklists may be obsolete. Start with the [current README](../README.md).

**Time**: 10-14 hours
**Dependencies**: Task 1 (webpack config complete), Task 2 (Components & API complete)
**Can Run Parallel With**: Task 4 (RSC Version)

---

## Overview

Build two traditional (non-RSC) versions of the restaurant search results page to compare against the RSC streaming version (Task 4).

The page displays a **search results grid** with 4 restaurant cards, each showing static info (name, image, cuisine, location) and 5 async data widgets (status, wait time, rating, specials, trending items).

### V1: Full Server SSR (`/search/ssr`)

All data is fetched on the Rails server **sequentially** before the page is returned. The browser receives a complete HTML page with all data already rendered — no spinners, no client-side fetching.

- Rails controller fetches ALL data for ALL restaurants (status, wait time, specials, trending, rating)
- Sequential Ruby `map` blocks mean each restaurant's queries run one after another
- With 4 restaurants × 5 queries each = ~20 sequential queries
- Total server time: ~1200-1500ms before first byte
- `react_component` renders the full page with all data as props
- **Result**: Slow TTFB, but once HTML arrives everything is visible immediately

**Expected Performance** (with network throttling):
- TTFB: ~1200-1500ms (waiting for all sequential queries)
- LCP: ~1300-1600ms
- CLS: ~0.00 (no layout shifts — all content arrives at once)

### V2: Client Components + Loadable (`/search/client`)

Only basic restaurant info is fetched on the server. The 5 async widgets per card are lazy-loaded client components that fetch their own data via `useEffect` + `fetch()` after hydration.

- **Key Principle**: Use `"use client"` at the root level. This makes ALL components in the tree become **client components** that go into the **client bundle** (not the RSC bundle).
- ✅ Root component: `"use client"` directive at the top
- ✅ All components underneath: become client components (can use hooks, state, effects)
- ✅ Static parts (card headers): SSRed on server
- ✅ Lazy-loaded widget components: **NOT SSRed** — only their Suspense fallbacks (skeletons) render on server
- ✅ Data fetches: client-side via useEffect/fetch (after hydration)
- Browser makes up to 20 API calls (4 restaurants × 5 endpoints), limited by browser's 6-connection-per-domain limit

**Expected Performance** (with network throttling):
- TTFB: ~100-200ms (only basic restaurant data fetched on server)
- LCP: ~600-800ms (waiting for client-side fetch waterfall)
- CLS: ~0.10-0.15 (skeleton placeholders replaced with content)

---

## Deliverables

### 1. V1: Full Server SSR Page

#### Rails View

Create `app/views/restaurants/search_ssr.html.erb`:

```erb
<%= react_component("SearchPageSSR", props: { restaurant_data: @restaurant_data }, prerender: true) %>
```

#### Page Component

Create `app/javascript/components/search/SearchPageSSR.tsx`:

```typescript
'use client';

import React from 'react';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { StatusBadge } from '../restaurant/StatusBadge';
import { WaitTimeBadge } from '../restaurant/WaitTimeBadge';
import { RatingBadge } from '../restaurant/RatingBadge';
import { SpecialsList } from '../restaurant/SpecialsList';
import { TrendingItems } from '../restaurant/TrendingItems';

interface RestaurantData {
  id: number;
  name: string;
  cuisine_type: string;
  city: string;
  state: string;
  image_url: string;
  latitude: number;
  longitude: number;
  average_rating: number;
  review_count: number;
  status: string;
  wait_time: number;
  specials: Promotion[];
  trending: MenuItem[];
}

interface Props {
  restaurant_data: RestaurantData[];
}

export default function SearchPageSSR({ restaurant_data }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Restaurant Search — Full Server SSR</h1>
      <p className="text-gray-500 mb-4">All data fetched on server sequentially before page is returned.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurant_data.map((restaurant) => (
          <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-4">
            <RestaurantCardHeader restaurant={restaurant} />

            {/* All widgets rendered with data — no spinners */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={restaurant.status} />
                <WaitTimeBadge minutes={restaurant.wait_time} />
              </div>
              <RatingBadge rating={restaurant.average_rating} count={restaurant.review_count} />
              <SpecialsList promotions={restaurant.specials} />
              <TrendingItems items={restaurant.trending} />
            </div>

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Key**: All data is passed as props from Rails. No client-side fetching. The page is slow to arrive (TTFB) but complete when it does.

---

### 2. V2: Client Components + Loadable Page

#### Rails View

Create `app/views/restaurants/search_client.html.erb`:

```erb
<%= react_component("SearchPageClient", props: { restaurants: @restaurants }, prerender: true) %>
```

#### Page Component

Create `app/javascript/components/search/SearchPageClient.tsx`:

```typescript
'use client';  // ← Makes this and ALL imported components into client components (client bundle)

import React, { Suspense, lazy } from 'react';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { CardWidgetsSkeleton } from '../shared/CardWidgetsSkeleton';

// Lazy-loaded widget component — NOT SSRed, only its fallback is
const AsyncRestaurantWidgets = lazy(() => import('../restaurant/AsyncRestaurantWidgets'));

interface Restaurant {
  id: number;
  name: string;
  cuisine_type: string;
  city: string;
  state: string;
  image_url: string;
  latitude: number;
  longitude: number;
  average_rating: number;
  review_count: number;
}

interface Props {
  restaurants: Restaurant[];
}

export default function SearchPageClient({ restaurants }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Restaurant Search — Client Components</h1>
      <p className="text-gray-500 mb-4">Basic info SSRed, async widgets fetched client-side.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurants.map((restaurant) => (
          <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-4">
            {/* Static content — SSRed on server */}
            <RestaurantCardHeader restaurant={restaurant} />

            {/* Lazy-loaded widgets — NOT SSRed, only skeleton renders on server */}
            <Suspense fallback={<CardWidgetsSkeleton />}>
              <AsyncRestaurantWidgets restaurantId={restaurant.id} />
            </Suspense>

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Async Widgets Component (Client-Side Fetching)

Create `app/javascript/components/restaurant/AsyncRestaurantWidgets.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { WaitTimeBadge } from './WaitTimeBadge';
import { RatingBadge } from './RatingBadge';
import { SpecialsList } from './SpecialsList';
import { TrendingItems } from './TrendingItems';

interface Props {
  restaurantId: number;
}

export default function AsyncRestaurantWidgets({ restaurantId }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [waitTime, setWaitTime] = useState<number | null>(null);
  const [rating, setRating] = useState<{ average_rating: number; review_count: number } | null>(null);
  const [specials, setSpecials] = useState<any[] | null>(null);
  const [trending, setTrending] = useState<any[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    // Fire all 5 fetches in parallel (limited by browser's 6-connection limit)
    fetch(`/api/restaurants/${restaurantId}/status`, opts).then(r => r.json()).then(setStatus).catch(() => {});
    fetch(`/api/restaurants/${restaurantId}/wait_time`, opts).then(r => r.json()).then(setWaitTime).catch(() => {});
    fetch(`/api/restaurants/${restaurantId}/rating`, opts).then(r => r.json()).then(setRating).catch(() => {});
    fetch(`/api/restaurants/${restaurantId}/specials`, opts).then(r => r.json()).then(setSpecials).catch(() => {});
    fetch(`/api/restaurants/${restaurantId}/trending`, opts).then(r => r.json()).then(setTrending).catch(() => {});

    return () => controller.abort();
  }, [restaurantId]);

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-3">
        {status && <StatusBadge status={status.status} />}
        {waitTime && <WaitTimeBadge minutes={waitTime.wait_time} />}
      </div>
      {rating && <RatingBadge rating={rating.average_rating} count={rating.review_count} />}
      {specials && <SpecialsList promotions={specials.promotions} />}
      {trending && <TrendingItems items={trending.items} />}
    </div>
  );
}
```

**Key**: Each card fires 5 parallel API fetches. With 4 cards = 20 fetches, but the browser limits to 6 concurrent connections per domain, creating a waterfall effect.

---

### 3. Routes Configuration

Already configured in `config/routes.rb`:

```ruby
get '/search/ssr', to: 'restaurants#search_ssr'       # V1: All data fetched on server
get '/search/client', to: 'restaurants#search_client'  # V2: Client-side fetch
```

---

### 4. Rails Controller

Already implemented in `app/controllers/restaurants_controller.rb`:

```ruby
class RestaurantsController < ApplicationController
  # V1: Full Server SSR — fetch ALL data, return complete page
  def search_ssr
    restaurants = fetch_restaurants
    @restaurant_data = restaurants.map do |r|
      {
        id: r.id, name: r.name, cuisine_type: r.cuisine_type,
        city: r.city, state: r.state, image_url: r.image_url,
        latitude: r.latitude, longitude: r.longitude,
        average_rating: r.average_rating, review_count: r.review_count,
        status: r.current_status,
        wait_time: r.current_wait_time,
        specials: r.active_promotions.map { |p| serialize_promotion(p) },
        trending: r.trending_items.map { |item| serialize_menu_item(item) },
      }
    end
  end

  # V2: Client Components — send basic info only, client fetches the rest
  def search_client
    @restaurants = fetch_restaurants_basic
  end

  private

  def fetch_restaurants
    Restaurant.by_cuisine(params[:cuisine] || 'Italian').in_city(params[:city] || 'New York').limit(4)
  end

  def fetch_restaurants_basic
    fetch_restaurants.select(:id, :name, :cuisine_type, :city, :state, :image_url,
                             :latitude, :longitude, :average_rating, :review_count)
  end
end
```

---

## Success Criteria

### V1: Full Server SSR (`/search/ssr`)
- [ ] Page loads with ALL data visible immediately (no spinners)
- [ ] TTFB is slow (~1200-1500ms) because of sequential server queries
- [ ] No CLS (all content arrives at once)
- [ ] No client-side API calls visible in DevTools Network tab

### V2: Client Components (`/search/client`)
- [ ] Static card headers visible immediately (SSRed)
- [ ] Skeleton placeholders visible initially
- [ ] All 20 API calls visible in DevTools Network tab (4 restaurants × 5 endpoints)
- [ ] Skeletons replaced with content when data arrives
- [ ] CLS ~0.10-0.15 (layout shifts when skeletons replaced)
- [ ] Console shows no errors

---

## Key Technical Details

### V1: Why Full Server SSR Is Slow

```
Timeline:
0ms:        Request arrives at Rails
0-1200ms:   Sequential queries: 4 restaurants × 5 queries each
            (Ruby map block = sequential, no parallelism)
1200ms:     react_component renders full page with all data
1200-1300ms: HTML sent to browser
1300-1400ms: JS bundles download, React hydrates
1400-1500ms: Page interactive (LCP)
```

The bottleneck is Ruby's sequential execution. Each restaurant's `current_status`, `current_wait_time`, `active_promotions`, `trending_items` run one after another.

### V2: Why Client Components Feel Slow

```
Timeline:
0-100ms:    SSRed HTML received (card headers + skeleton placeholders)
100-150ms:  JS bundles download (main bundle + lazy chunk)
150-200ms:  React hydrates
200-250ms:  Lazy AsyncRestaurantWidgets loads, useEffect fires 20 fetch()s
250-500ms:  First batch of responses (6 concurrent, browser limit)
500-650ms:  Second batch of responses
650-800ms:  All content visible (LCP)
```

The waterfall: lazy component must load → mount → useEffect fires → 20 API calls limited to 6 concurrent → multiple round trips.

### What "use client" Does

`"use client"` marks the boundary where components become **client components**:
- ✅ The component AND all components it imports become client components
- ✅ Client components go into the **client bundle** (NOT the RSC bundle)
- ✅ Static parts of client components CAN be SSRed
- ❌ Lazy-loaded components (via `lazy()`) are NOT SSRed — only their fallbacks render
- ✅ Client components can use hooks (useState, useEffect, etc.), state, and context
- ❌ Component is NOT in RSC bundle (excluded from server components)

---

## Files Created/Modified

- ✅ `app/javascript/components/search/SearchPageSSR.tsx` (V1 page component)
- ✅ `app/javascript/components/search/SearchPageClient.tsx` (V2 page component)
- ✅ `app/javascript/components/restaurant/AsyncRestaurantWidgets.tsx` (V2 client-side fetching)
- ✅ `app/views/restaurants/search_ssr.html.erb` (V1 Rails view)
- ✅ `app/views/restaurants/search_client.html.erb` (V2 Rails view)
- ✅ `app/controllers/restaurants_controller.rb` (already implemented)
- ✅ `config/routes.rb` (already configured)

---

## Notes

- Both V1 and V2 use the same webpack config created in Task 1
- V1 demonstrates the cost of sequential server-side data fetching (slow TTFB)
- V2 demonstrates the cost of client-side fetch waterfall (fast TTFB, slow LCP)
- V3 (RSC, Task 4) solves both problems with server-side streaming
- The three versions share the same display components, API endpoints, and database
- Performance differences are best demonstrated with Chrome DevTools network throttling

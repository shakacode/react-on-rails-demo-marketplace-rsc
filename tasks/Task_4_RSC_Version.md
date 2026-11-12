# Task 4: RSC Version (V3)

> **Historical planning document.** This is the original proposal, not current operating instructions or a record of what shipped. Routes, commands, dataset sizes, performance targets, and checklists may be obsolete. Start with the [current README](../README.md).

**Time**: 10-14 hours
**Dependencies**: Task 1 (webpack config complete), Task 2 (Components & API complete)
**Can Run Parallel With**: Task 3 (Traditional Versions)

---

## Overview

Build the React Server Components (RSC) + streaming version of the restaurant search results page. This demonstrates how RSC with async props dramatically improves Web Vitals by fetching data server-side and streaming HTML as each piece resolves.

The page displays a **search results grid** with 4 restaurant cards, each with 5 async data widgets — identical layout to V1 and V2, but with fundamentally different data fetching.

**Key Principle**: Root component is an async function WITHOUT `"use client"` directive:
- ✅ Put in the RSC bundle (server components)
- ✅ SSRed via RSC pipeline (server-side async rendering)
- ✅ Data fetched server-side via `getReactOnRailsAsyncProp` (received as a **prop**, NOT imported)
- ✅ Streamed to browser as Suspense boundaries resolve
- ✅ Client components CAN exist lower in tree (with `"use client"` directive) for interactivity
- ❌ No `"use client"` at root level

**How Async Props Work** (react_on_rails v16.3+):
1. Rails view uses `stream_react_component_with_async_props` helper with an `emit` block
2. The emit block calls `emit.call("prop_name", value)` to send data to the Node renderer
3. The React component receives `getReactOnRailsAsyncProp` as a **prop** (injected by the framework)
4. Async server components call `await getReactOnRailsAsyncProp("prop_name")` to get the data
5. Each emit resolves the corresponding promise, allowing that Suspense boundary to render
6. HTML is streamed to the browser as each boundary resolves

**Expected Performance** (with network throttling):
- TTFB: ~50-100ms (streaming starts immediately, data fetched in parallel on server)
- LCP: ~200-350ms (all data streamed server-side)
- CLS: ~0.02-0.08 (Suspense fallbacks replaced with streamed content — brief but present)

---

## Deliverables

### 1. Entry Point

Create `app/javascript/entries/search_rsc.tsx`:

```typescript
import React from 'react';
import SearchPageRSC from '../components/search/SearchPageRSC';

export default SearchPageRSC;
```

---

### 2. Root Server Component

Create `app/javascript/components/search/SearchPageRSC.tsx`:

```typescript
// No "use client" directive!
// This means: put in RSC bundle (server components), not client bundle

import React, { Suspense } from 'react';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { CardWidgetsSkeleton } from '../shared/CardWidgetsSkeleton';
import AsyncRestaurantWidgetsRSC from '../restaurant/AsyncRestaurantWidgetsRSC';

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
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

// Async server component (RSC) — no hooks allowed
export default async function SearchPageRSC({ restaurants, getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Restaurant Search — RSC Streaming</h1>
      <p className="text-gray-500 mb-4">Data streamed from server as each piece resolves.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurants.map((restaurant) => (
          <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-4">
            {/* Static content — rendered immediately */}
            <RestaurantCardHeader restaurant={restaurant} />

            {/* Async widgets — streamed as data resolves on server */}
            <Suspense fallback={<CardWidgetsSkeleton />}>
              <AsyncRestaurantWidgetsRSC
                restaurantId={restaurant.id}
                getReactOnRailsAsyncProp={getReactOnRailsAsyncProp}
              />
            </Suspense>

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Key differences from V2 (Task 3)**:
- ❌ No `"use client"` directive — component is in RSC bundle
- ✅ `async function` (server component pattern)
- ✅ `getReactOnRailsAsyncProp` received as a **prop** (injected by react_on_rails)
- ✅ Data fetched on server, streamed to browser

---

### 3. Async Server Component for Widgets

Create `app/javascript/components/restaurant/AsyncRestaurantWidgetsRSC.tsx`:

```typescript
// No "use client" — this is a server component
import React from 'react';
import { StatusBadge } from './StatusBadge';
import { WaitTimeBadge } from './WaitTimeBadge';
import { RatingBadge } from './RatingBadge';
import { SpecialsList } from './SpecialsList';
import { TrendingItems } from './TrendingItems';

interface Props {
  restaurantId: number;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

// Server component — awaits data from Rails via async props
export default async function AsyncRestaurantWidgetsRSC({
  restaurantId,
  getReactOnRailsAsyncProp,
}: Props) {
  // Each await resolves when Rails emits the corresponding prop
  // The prop names match the keys used in the Rails view's emit block
  const propName = `restaurant_${restaurantId}_widgets`;
  const data = await getReactOnRailsAsyncProp(propName);

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={data.status} />
        <WaitTimeBadge minutes={data.wait_time} />
      </div>
      <RatingBadge rating={data.average_rating} count={data.review_count} />
      <SpecialsList promotions={data.specials} />
      <TrendingItems items={data.trending} />
    </div>
  );
}
```

**Key**: No `useState`, no `useEffect`, no `fetch()`. Data comes from `getReactOnRailsAsyncProp` which resolves when Rails emits the prop via the view's emit block.

---

### 4. Rails View (with Async Props Emit Block)

Create `app/views/restaurants/search_rsc.html.erb`:

```erb
<%= stream_react_component_with_async_props("SearchPageRSC",
      props: { restaurants: @restaurants },
      html_options: { id: "search-rsc-app" }) do |emit|

  # Fetch and emit widget data for each restaurant
  # Each emit.call resolves the corresponding getReactOnRailsAsyncProp promise
  @restaurants.each do |restaurant|
    widget_data = {
      status: restaurant.current_status,
      wait_time: restaurant.current_wait_time,
      average_rating: restaurant.average_rating,
      review_count: restaurant.review_count,
      specials: restaurant.active_promotions.map { |p|
        { id: p.id, title: p.title, description: p.description,
          discount_type: p.discount_type, discount_value: p.discount_value,
          code: p.code, ends_at: p.ends_at.iso8601 }
      },
      trending: restaurant.trending_items.map { |item|
        { id: item.id, name: item.name, category: item.category,
          price: item.price.to_f, description: item.description }
      },
    }

    emit.call("restaurant_#{restaurant.id}_widgets", widget_data)
  end
%>
```

**Key**: The emit block is where all data fetching happens on the Rails side. Each `emit.call` sends data to the Node renderer, resolving the matching `getReactOnRailsAsyncProp` promise.

**Important**: There is NO separate AsyncProps Ruby module. The emit block in the view IS the data fetching layer.

---

### 5. Rails Controller

Already implemented in `app/controllers/restaurants_controller.rb`:

```ruby
class RestaurantsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:search_rsc]

  # V3: RSC Streaming — send basic info, server components fetch async data
  def search_rsc
    @restaurants = fetch_restaurants_basic
    stream_view_containing_react_components(template: "restaurants/search_rsc")
  end
end
```

---

### 6. Routes Configuration

Already configured in `config/routes.rb`:

```ruby
get '/search/rsc', to: 'restaurants#search_rsc'  # V3: RSC streaming
```

---

## How Async Props Work (react_on_rails v16.3+)

### Architecture

```
Browser ←── HTTP/2 Stream ──→ Node Renderer ←── Bidirectional Stream ──→ Rails Server
                                    ↑
                          AsyncPropsManager
                          (resolves promises as
                           Rails emits props)
```

### Flow

```
1. Browser requests /search/rsc
2. Rails controller calls stream_view_containing_react_components
3. View calls stream_react_component_with_async_props with initial props + emit block
4. Node renderer starts rendering SearchPageRSC with initial props + getReactOnRailsAsyncProp function
5. SearchPageRSC renders restaurant cards, each with <Suspense fallback={<Skeleton/>}>
6. AsyncRestaurantWidgetsRSC calls await getReactOnRailsAsyncProp("restaurant_1_widgets")
   → Returns a Promise that the AsyncPropsManager holds
7. Rails emit block runs: emit.call("restaurant_1_widgets", { status: "open", ... })
   → Data sent to Node renderer, promise resolves
8. Suspense boundary resolves, HTML streamed to browser
9. Repeat for each restaurant
10. Browser receives streamed HTML chunks, replacing skeletons with content
```

### getReactOnRailsAsyncProp — Important Details

- **NOT an import** — it is injected as a **prop** by the react_on_rails framework
- Returns a `Promise<T>` that resolves when the corresponding `emit.call` fires on the Rails side
- The prop name string (e.g., `"restaurant_1_widgets"`) must match between the React `await` call and the Rails `emit.call`
- Multiple async props can resolve independently, enabling progressive streaming

---

## Success Criteria

- [ ] `/search/rsc` page loads and renders with streaming
- [ ] All data fetched on SERVER (no client-side API calls in DevTools Network)
- [ ] HTML streamed to browser as each restaurant's data resolves
- [ ] Brief skeleton fallbacks visible during streaming (~100-200ms)
- [ ] Skeletons replaced with content as streamed HTML arrives
- [ ] No hydration errors
- [ ] CLS: ~0.02-0.08 (minimal shifts from skeleton replacement)
- [ ] LCP: ~200-350ms (dramatically faster than V1 and V2)
- [ ] Console shows no errors or warnings

---

## Key Technical Details

### Server Components (RSC Constraints)

Server components **CANNOT**:
- Use `useState`, `useEffect`, `useCallback`, etc. (React hooks)
- Use `useContext` (Context API)
- Use browser APIs (localStorage, window, etc.)
- Be marked with `"use client"`

Server components **CAN**:
- Be declared as `async function`
- Await data via `getReactOnRailsAsyncProp`
- Import and render display components
- Import and render client components (with `"use client"`) for interactivity

### Why RSC Streaming Is Faster Than V1 and V2

```
V1 (Full SSR):       V2 (Client):         V3 (RSC Streaming):
─────────────        ─────────────        ──────────────────
0ms: Request         0ms: Request         0ms: Request
                     100ms: HTML (basic)  50ms: Stream starts (headers + skeletons)
                     200ms: Hydrate       100ms: First restaurant data streamed
                     250ms: fetch() ×20   150ms: Second restaurant streamed
                     500ms: Batch 1       200ms: Third restaurant streamed
                     650ms: Batch 2       250ms: Fourth restaurant streamed
1200ms: HTML (all)   800ms: All done      300ms: All done (LCP)
1400ms: LCP
```

- **vs V1**: RSC streams incrementally; V1 waits for ALL queries before sending anything
- **vs V2**: RSC fetches on server (fast DB queries, no network round trips); V2 fetches from browser (HTTP overhead × 20)
- **vs Both**: RSC can run queries in parallel on the server (each emit.call is independent)

### CLS in RSC Streaming

RSC streaming DOES have brief CLS (~0.02-0.08) because:
- Initial HTML includes skeleton fallbacks from `<Suspense fallback={<CardWidgetsSkeleton />}>`
- When streamed data arrives (~100-200ms later), skeletons are replaced with actual content
- The CardWidgetsSkeleton component is designed to match widget dimensions, minimizing shift
- Duration is much shorter than V2 (~100-200ms vs ~500-600ms)

---

## Troubleshooting

**Problem**: `getReactOnRailsAsyncProp is not defined`
- **Solution**: Ensure it's received as a prop, not imported. Check that the view uses `stream_react_component_with_async_props` (not `stream_react_component`)

**Problem**: Props never resolve (infinite skeleton)
- **Solution**: Check that emit.call prop names match getReactOnRailsAsyncProp names exactly

**Problem**: Server component hangs
- **Solution**: Check query latency, ensure emit block completes, check Node renderer logs

**Problem**: Hydration mismatch error
- **Solution**: Ensure no hooks in server components, verify no `"use client"` on RSC components

---

## Files Created/Modified

- ✅ `app/javascript/entries/search_rsc.tsx` (webpack entry point)
- ✅ `app/javascript/components/search/SearchPageRSC.tsx` (root server component)
- ✅ `app/javascript/components/restaurant/AsyncRestaurantWidgetsRSC.tsx` (async server component)
- ✅ `app/views/restaurants/search_rsc.html.erb` (Rails view with emit block)
- ✅ `app/controllers/restaurants_controller.rb` (already implemented)
- ✅ `config/routes.rb` (already configured)

---

## Notes

- Tasks 3 & 4 use the SAME webpack config created in Task 1
- Same display components shared across all three versions
- **Key differences from Task 3**:
  - Task 3 V1 (Full SSR): All data fetched sequentially on server → slow TTFB, no CLS
  - Task 3 V2 (Client): `"use client"` at root → client bundle → lazy components NOT SSRed → client-side fetch waterfall
  - Task 4 V3 (RSC): No `"use client"` at root → RSC bundle → async props with emit block → server-side streaming
- `getReactOnRailsAsyncProp` is a PROP (injected by framework), NOT an import
- `stream_react_component_with_async_props` (NOT `stream_react_component`) is the view helper
- No separate AsyncProps Ruby module — the emit block in the view IS the data fetching layer
- Requires react_on_rails v16.3+ for async props support
- Performance differences are best demonstrated with Chrome DevTools network throttling

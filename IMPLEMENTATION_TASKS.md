# LocalHub: Simplified Implementation Tasks (5 Tasks)

> **Historical planning document.** This is the original proposal, not current operating instructions or a record of what shipped. Routes, commands, dataset sizes, performance targets, and checklists may be obsolete. Start with the [current README](./README.md).

**A demo app should be simple and focused. These 5 tasks cover everything needed.**

---

## Task 1: Setup & Database (8-12 hours)

**Goal**: Rails app, database schema, realistic data seeding

### Deliverables

**Rails Application**:
- Rails 7.1 with TypeScript, React 19, Tailwind CSS
- PostgreSQL 14+
- Pre-commit hooks (rubocop, eslint, prettier)

**Database Schema** (8 tables):
```
restaurants (50K)
├─ hours (400K)
├─ special_hours (150K)
├─ reviews (2M)
├─ menu_items (500K)
├─ promotions (100K)
└─ orders (10M) ← CRITICAL: Drives query latency
   └─ order_lines (50M)
```

**Data Seeding**:
- 50K restaurants
- 10M orders (MUST achieve 100-150ms query latency)
- All related data
- Must complete in <30 minutes
- Verify with: `rake db:seed:verify`

### Success Criteria

- [ ] `rails server` starts on port 3000
- [ ] Database has 62M+ records
- [ ] `restaurant.current_wait_time` takes 100-150ms
- [ ] `restaurant.current_status` takes 20-30ms
- [ ] All 4 concurrent queries take 150-200ms total

### Key Files

- `Gemfile` (with react-on-rails, rspec)
- `package.json` (React 19, TypeScript, Tailwind)
- `db/migrate/` (9 migrations)
- `db/seeds.rb` + seed scripts
- `app/models/` (Restaurant, Order, Review, MenuItem, etc.)

### Notes

- **Task 1.4 (Data Seeding) is CRITICAL** - Demo credibility depends on realistic query latency
- Without 10M orders, wait_time queries will be <50ms, and RSC advantage won't be visible
- Use `insert_all` for bulk inserts, not `create`
- Run `VACUUM ANALYZE` after seeding

---

## Task 2: Shared Components & API (12-16 hours)

**Goal**: Display components and API endpoints used by all three versions

### Deliverables

**Display Components** (100% shared across V1, V2, V3):
- `StatusBadge` - "Open", "Closed", "Custom Hours"
- `WaitTimeBadge` - "25 min wait"
- `SpecialsList` - Active promotions
- `RatingBadge` - "4.5 (1,234 reviews)"
- `TrendingItems` - Top 3 popular items
- `RestaurantCardHeader` - Name, image, cuisine
- `RestaurantCardFooter` - Rating, distance (uses Haversine formula)
- `CardWidgetsSkeleton` - Skeleton placeholder for async widgets
- `Spinner` - Loading spinner with optional label
- Design system with Tailwind tokens

**API Endpoints** (used by V2 client-side fetching):
- `GET /api/restaurants/:id/status` → "open" | "closed" | "custom_hours"
- `GET /api/restaurants/:id/wait_time` → wait time in minutes
- `GET /api/restaurants/:id/specials` → active promotions
- `GET /api/restaurants/:id/trending` → top 3 items
- `GET /api/restaurants/:id/rating` → average rating + count

**Routes**:
- `GET /search/ssr` → V1: Full Server SSR
- `GET /search/client` → V2: Client Components + Loadable
- `GET /search/rsc` → V3: RSC Streaming
- All API endpoints under `/api/`

### Success Criteria

- [ ] All display components render correctly
- [ ] API endpoints return correct JSON
- [ ] Wait time API response: 100-150ms (proves realistic latency)
- [ ] All components TypeScript with full types
- [ ] Tailwind styling is polished (looks professional)

### Key Files

- `app/javascript/components/restaurant/` (display components)
- `app/javascript/components/shared/` (Spinner, CardWidgetsSkeleton)
- `app/javascript/utils/distance.ts` (Haversine distance calculation)
- `app/controllers/api/restaurants_controller.rb`
- `config/routes.rb`
- `app/javascript/types/index.ts`

### Notes

- Display components take data as props only (no hooks, no state)
- All components are purely presentational
- API responses should include timing metadata for metrics collection

---

## Task 3: Traditional Versions — V1 + V2 (10-14 hours)

**Goal**: Two traditional (non-RSC) versions of the restaurant search results page

**Important**: Tasks 3 & 4 share the same webpack config from Task 1. The difference is how data is fetched:
- **V1 (Full SSR)**: All data fetched sequentially on Rails server → slow TTFB, complete page
- **V2 (Client)**: `"use client"` at root → lazy components NOT SSRed → client-side fetch waterfall
- **V3 (RSC, Task 4)**: No `"use client"` → RSC bundle → async props with emit block → server-side streaming

### V1: Full Server SSR (`/search/ssr`)

All data fetched on the Rails server **sequentially** in the controller. Browser receives a complete page.

```ruby
# Controller fetches ALL data sequentially
def search_ssr
  restaurants = fetch_restaurants
  @restaurant_data = restaurants.map do |r|
    { id: r.id, name: r.name, status: r.current_status,
      wait_time: r.current_wait_time, specials: ..., trending: ... }
  end
end
```

```erb
<!-- View passes all data as props -->
<%= react_component("SearchPageSSR", props: { restaurant_data: @restaurant_data }, prerender: true) %>
```

**Expected Performance**: TTFB ~1200-1500ms (sequential queries), LCP ~1400-1600ms, CLS ~0.00

### V2: Client Components + Loadable (`/search/client`)

Only basic info fetched on server. Async widgets lazy-loaded and fetch data client-side.

```typescript
'use client';  // Makes ALL components into client components

const AsyncRestaurantWidgets = lazy(() => import('../restaurant/AsyncRestaurantWidgets'));

export default function SearchPageClient({ restaurants }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {restaurants.map((restaurant) => (
        <div key={restaurant.id}>
          <RestaurantCardHeader restaurant={restaurant} />
          <Suspense fallback={<CardWidgetsSkeleton />}>
            <AsyncRestaurantWidgets restaurantId={restaurant.id} />
          </Suspense>
          <RestaurantCardFooter restaurant={restaurant} />
        </div>
      ))}
    </div>
  );
}
```

**Expected Performance**: TTFB ~100-200ms, LCP ~600-800ms (fetch waterfall), CLS ~0.10-0.15

### Success Criteria

- [ ] V1: All data visible immediately, slow TTFB
- [ ] V2: Skeletons visible, then replaced with content
- [ ] V2: 20 API calls visible in DevTools Network (4 restaurants × 5 endpoints)
- [ ] Both pages render identical restaurant grid layout
- [ ] Console shows no errors

### Key Files

- `app/javascript/components/search/SearchPageSSR.tsx` (V1)
- `app/javascript/components/search/SearchPageClient.tsx` (V2)
- `app/javascript/components/restaurant/AsyncRestaurantWidgets.tsx` (V2 client fetching)
- `app/views/restaurants/search_ssr.html.erb`
- `app/views/restaurants/search_client.html.erb`
- `app/controllers/restaurants_controller.rb`

### Notes

- Both versions exist in same app, different routes/templates
- Same database, same API, same display components
- V1 shows the cost of sequential server queries (slow TTFB)
- V2 shows the cost of client-side fetch waterfall (fast TTFB, slow LCP)
- Performance differences best demonstrated with Chrome DevTools network throttling

---

## Task 4: RSC Version — V3 (10-14 hours)

**Goal**: Server Components + streaming with async props (react_on_rails v16.3+)

### How Async Props Work

The RSC version uses `stream_react_component_with_async_props` with an emit block:

1. **Rails view** uses `stream_react_component_with_async_props` with initial props + emit block
2. **Emit block** calls `emit.call("prop_name", value)` to send data to Node renderer
3. **React component** receives `getReactOnRailsAsyncProp` as a **PROP** (NOT an import)
4. **Async server components** call `await getReactOnRailsAsyncProp("prop_name")` to get data
5. Each emit resolves the corresponding promise → Suspense boundary resolves → HTML streamed

```erb
<!-- Rails view with emit block — NO separate AsyncProps module needed -->
<%= stream_react_component_with_async_props("SearchPageRSC",
      props: { restaurants: @restaurants }) do |emit|

  @restaurants.each do |restaurant|
    emit.call("restaurant_#{restaurant.id}_widgets", {
      status: restaurant.current_status,
      wait_time: restaurant.current_wait_time,
      # ... more data
    })
  end
%>
```

```typescript
// Server component — getReactOnRailsAsyncProp is a PROP, not an import
async function AsyncRestaurantWidgetsRSC({ restaurantId, getReactOnRailsAsyncProp }: Props) {
  const data = await getReactOnRailsAsyncProp(`restaurant_${restaurantId}_widgets`);
  return (
    <>
      <StatusBadge status={data.status} />
      <WaitTimeBadge minutes={data.wait_time} />
    </>
  );
}
```

### Success Criteria

- [ ] All data fetched server-side (no client-side API calls in DevTools)
- [ ] HTML streamed to browser with Suspense boundaries
- [ ] Brief skeleton fallbacks during streaming (~100-200ms)
- [ ] LCP: ~200-350ms (dramatically faster than V1 and V2)
- [ ] CLS: ~0.02-0.08 (minimal shifts from skeleton replacement)
- [ ] No hydration errors

### Key Files

- `app/javascript/components/search/SearchPageRSC.tsx` (root server component)
- `app/javascript/components/restaurant/AsyncRestaurantWidgetsRSC.tsx` (async server component)
- `app/views/restaurants/search_rsc.html.erb` (Rails view with emit block)
- `app/controllers/restaurants_controller.rb` (already implemented)

### Notes

- `getReactOnRailsAsyncProp` is a **PROP** (injected by framework), NOT an import
- Use `stream_react_component_with_async_props` (NOT `stream_react_component`)
- No separate AsyncProps Ruby module — the emit block in the view IS the data fetching layer
- Requires react_on_rails v16.3+ for async props support
- Server components cannot use hooks, state, or context (RSC constraint)
- Same display components as V1 and V2
- CLS is NOT zero — Suspense fallbacks cause brief layout shifts (~0.02-0.08)

---

## Task 5: Comparison Dashboard & Documentation (6-10 hours)

**Goal**: Compare all three versions and document the project

### Deliverables

**Comparison Dashboard**:
- Route: `/dashboard`
- Side-by-side metrics: V1 (Full SSR) vs V2 (Client) vs V3 (RSC)
- Charts: LCP over time, CLS distribution
- Network waterfall visualization
- Key stats showing RSC advantages

**Comparison View**:
- Route: `/comparison`
- Three iframes: V1 + V2 + V3
- Synchronized scrolling
- Real-time metrics overlay

**Documentation**:
- `README.md` - What is LocalHub, how to run it
- `DEPLOYMENT.md` - How to deploy
- `DEMO_WALKTHROUGH.md` - How to present it (including Chrome DevTools throttling instructions)
- Inline code comments

### Success Criteria

- [ ] Dashboard accessible and metrics accurate
- [ ] Comparison view works smoothly with all three versions
- [ ] Documentation is clear and complete
- [ ] Demo is ready to show to customers

### Key Files

- `app/javascript/components/ComparisonDashboard.tsx`
- `app/javascript/components/ComparisonView.tsx`
- `app/controllers/dashboard_controller.rb`
- `app/views/dashboard/index.html.erb`
- `README.md`, `DEPLOYMENT.md`, `DEMO_WALKTHROUGH.md`

### Notes

- Dashboard pulls metrics from all three versions
- Should highlight V3's dramatic improvement over V1 and V2
- Comparison view is the "wow" moment for customers
- Include instructions for Chrome DevTools network/CPU throttling to make differences visible

---

## Timeline & Effort

| Task | Time | Notes |
|------|------|-------|
| 1. Setup & Database | 8-12h | **CRITICAL**: Data seeding determines demo credibility |
| 2. Shared Components & API | 12-16h | Used by all three versions, done once |
| 3. Traditional Versions (V1 + V2) | 10-14h | Can run parallel with Task 4 |
| 4. RSC Version (V3) | 10-14h | Can run parallel with Task 3 |
| 5. Dashboard & Docs | 6-10h | After 3 & 4 complete |
| **Total** | **46-66h** | **5-8 weeks with 1 developer** |

**With 2 developers**: 3-4 weeks (Task 3 & 4 in parallel)

---

## Dependency Chain

```
Task 1 (Setup & Database) [BLOCKING]
  ↓
Task 2 (Shared Components & API)
  ↓
[PARALLELIZATION POINT]
  ├─ Task 3 (V1: Full SSR + V2: Client)  [Can run in parallel]
  ├─ Task 4 (V3: RSC Streaming)          [Can run in parallel]
  ↓
Task 5 (Dashboard & Docs)
```

---

## Three-Version Architecture

### Why Three Versions?

Each version isolates a different performance bottleneck:

| Version | Route | Data Fetching | Bottleneck |
|---------|-------|---------------|------------|
| V1: Full Server SSR | `/search/ssr` | All data on server, sequential | Slow TTFB (~1200ms) — Ruby sequential queries |
| V2: Client Components | `/search/client` | Basic info SSR, widgets fetch client-side | Slow LCP (~700ms) — client fetch waterfall, 6-connection limit |
| V3: RSC Streaming | `/search/rsc` | All data on server, streamed | Fast everything (~300ms) — server streaming, no waterfall |

### Performance Comparison (with network throttling)

```
Metric          V1 (Full SSR)    V2 (Client)    V3 (RSC)
──────          ─────────────    ───────────    ────────
TTFB            ~1200-1500ms     ~100-200ms     ~50-100ms
LCP             ~1400-1600ms     ~600-800ms     ~200-350ms
CLS             ~0.00            ~0.10-0.15     ~0.02-0.08
```

### Demo Flow

1. Open all three versions side by side
2. Enable Chrome DevTools → Network → "Slow 3G" or "Fast 3G" throttling
3. Refresh all three simultaneously
4. Observe:
   - V1: Long white screen, then everything appears at once
   - V2: Quick first paint with skeletons, then slow fill-in over ~600ms
   - V3: Quick first paint with skeletons, then fast streaming fill-in over ~200ms

---

## Critical Success Factor: Task 1.4 (Data Seeding)

**This is make-or-break for the demo.**

- If queries take <50ms: Demo fails (all versions look the same)
- If queries take 100-150ms: Demo succeeds (V3 advantage is dramatic)

**Verification**:
```bash
time rails db:seed
rake db:seed:verify
# Should show:
# Orders: 10,000,045 ✓
# current_wait_time: 142ms ✓
# All queries parallel: 178ms ✓
```

**If latency is wrong**:
- Add more orders? No, 10M is already a lot
- Check indexes? Yes, must be created
- Check queries? Yes, aggregation must be correct
- Check data distribution? Yes, orders spread across restaurants

---

## Code Sharing Breakdown

**How 82-85% code reuse happens**:

| Category | % of Code | Shared? | Notes |
|----------|-----------|---------|-------|
| Database, Models, API | 30% | 100% | All versions use same data |
| Display Components | 20% | 100% | StatusBadge, etc. are pure components |
| Tailwind Styling | 15% | 100% | Same design system |
| Routes, Layouts | 10% | 100% | /search/ssr, /search/client, /search/rsc |
| Async Component Structure | 10% | 90% | Similar pattern, different data source |
| Tests | 5% | 100% | Test all versions |
| Webpack Config | 5% | 0% | Different bundles (client vs RSC) |
| Data Fetching Logic | 5% | 0% | Inline props vs fetch() vs getReactOnRailsAsyncProp |

**Result**: ~82-85% code reuse

---

## Next Steps

1. **Review this plan** - Make sure 5 tasks make sense
2. **Assign developers** - Task 1 blocks everything; Tasks 3 & 4 can parallelize
3. **Start Task 1** - Database is critical path
4. **Monitor latency** - Verify Task 1.4 achieves 100-150ms queries
5. **Execute Tasks 2-5** in order

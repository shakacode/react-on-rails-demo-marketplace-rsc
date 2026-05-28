# LocalHub Demo: RSC + Streaming vs Traditional SSR

A restaurant marketplace discovery platform demonstrating how React Server Components with streaming dramatically improve Web Vitals compared to traditional SSR + lazy-loading.

## Demo and Source

- Live demo: https://rsc.reactonrails.com
- Source code: https://github.com/shakacode/react-server-components-marketplace-demo
- Contributor guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Issue tracker: https://github.com/shakacode/react-server-components-marketplace-demo/issues

## Quick Start

**The Problem**: Public-facing marketplace pages with dynamic real-time content suffer poor Web Vitals (slow LCP, high CLS) using traditional SSR + lazy-loading.

**The Solution**: React Server Components fetch all data server-side in parallel, stream complete HTML. Dramatically improves Web Vitals.

**The Results**:
- Traditional: LCP ~500-600ms, CLS ~0.10-0.15
- RSC: LCP ~200-250ms, CLS ~0.02
- **Improvement: 59% faster LCP, 83% less layout shift**

## Two Versions

```
/search         → Traditional: SSR static + lazy-load dynamic parts
/search/rsc     → RSC: Server-side fetch all + stream complete
/dashboard      → Metrics comparison
/comparison     → View both side-by-side
```

## Implementation (5 Tasks, 46-66 hours)

See `IMPLEMENTATION_TASKS.md` for detailed specifications.

| Task | Time | What |
|------|------|------|
| 1. Setup & Database | 8-12h | Rails app, PostgreSQL, seed 62M records |
| 2. Shared Components & API | 12-16h | Display components, 5 API endpoints |
| 3. Traditional Version | 10-14h | "use client" boundary, `react_component` helper |
| 4. RSC Version | 10-14h | Async server components, `stream_react_component` helper |
| 5. Dashboard & Docs | 6-10h | Metrics, demo walkthrough, deployment |

**Note**: Tasks 3 & 4 share the same webpack config (RSC-based). Only the component patterns and Rails helpers differ.

**Critical Path**: Task 1 (blocks everything) → Task 2 (blocks both versions) → Tasks 3&4 (parallel) → Task 5

## Architecture Decisions

### 1. One Database, One Webpack Config (RSC-based)

**Shared** (82-85% code reuse):
- Same PostgreSQL database (50K restaurants, 10M orders)
- Same Rails models & API endpoints
- Same display components (StatusBadge, WaitTimeBadge, etc.)
- Same Tailwind styling
- **Same webpack config** (RSC-based, produces 3 bundles: client, server, RSC)

**Different**:
- Which bundle renders the page (server bundle vs RSC bundle)
- Data fetching timing (client-side vs server-side)
- Rails helpers (`react_component` vs `stream_react_component`)
- Root component pattern ("use client" for traditional vs async function for RSC)

### 2. Realistic Query Latency is Essential

Wait time query scans 10M orders table, naturally takes **100-150ms**.

**Why critical**:
- <50ms queries: Both versions equally fast, demo fails
- 100-150ms queries: RSC advantage dramatic and real
- Proves benefit is architectural, not artificial

### 3. Traditional Version is Optimized

Traditional version uses best practices:
- SSR all static parts completely
- Only lazy-load dynamic parts
- No artificial slowdowns

Ensures RSC advantage is credible.

## Key Technical Details

### Display Components (100% Shared)

Same components used by both versions—pure functions taking data as props. NO hooks, state, or data fetching.

Examples: StatusBadge, WaitTimeBadge, RatingBadge, SpecialsList, TrendingItems

### Data Fetching Patterns

**Both versions use the same RSC webpack config.** The difference is which bundle renders the page:

**Traditional Version** (uses client bundle with SSR):
```typescript
// SearchPage.tsx - Root component with "use client"
"use client";  // ← Makes this and ALL imported components into client components

import React, { Suspense, lazy } from 'react';
import RestaurantCardHeader from '../restaurant/RestaurantCardHeader';
import Spinner from '../shared/Spinner';

// Lazy-loaded components - these are NOT SSRed, only their fallbacks are
const AsyncStatus = lazy(() => import('../async/traditional/AsyncStatus'));
const AsyncWaitTime = lazy(() => import('../async/traditional/AsyncWaitTime'));
const AsyncSpecials = lazy(() => import('../async/traditional/AsyncSpecials'));
const AsyncTrending = lazy(() => import('../async/traditional/AsyncTrending'));
const AsyncRating = lazy(() => import('../async/traditional/AsyncRating'));

export default function SearchPage({ restaurantId }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Restaurant Details</h1>

      {/* Static content - SSRed */}
      <RestaurantCardHeader restaurantId={restaurantId} />

      {/* Lazy-loaded content - NOT SSRed, only spinners render on server */}
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Suspense fallback={<Spinner label="Checking status..." />}>
            <AsyncStatus restaurantId={restaurantId} />
          </Suspense>

          <Suspense fallback={<Spinner label="Getting wait time..." />}>
            <AsyncWaitTime restaurantId={restaurantId} />
          </Suspense>

          {/* ... more async components */}
        </div>
      </div>
    </div>
  );
}

// AsyncStatus.tsx - Lazy-loaded component (NOT SSRed)
export default function AsyncStatus({ restaurantId }: Props) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}/status`)
      .then(res => res.json())
      .then(setStatus);
  }, [restaurantId]);
  return status ? <StatusBadge status={status} /> : null;
}
```
- ✅ `"use client"` at root level → all components become client components
- ✅ Components go into client bundle (NOT RSC bundle)
- ✅ Static parts SSRed, but lazy-loaded components are NOT SSRed (only fallbacks render)
- ✅ Async components lazy-loaded (separate chunks, imported via `lazy()`)
- ✅ Data fetches client-side (useEffect/fetch) → 500-600ms LCP

**RSC Version** (uses RSC bundle):
```typescript
// SearchPage.tsx - Async server component (no "use client")
// No "use client" = server component, goes into RSC bundle
async function SearchPage({ restaurantId }: Props) {
  // Data fetches SERVER-SIDE before rendering
  const status = await getReactOnRailsAsyncProp('status', { restaurantId });

  // Component renders with data already resolved
  return <StatusBadge status={status} />;
}
```
- ✅ Server component (no "use client") → goes into RSC bundle
- ✅ SSRed via RSC pipeline (streamed as Suspense resolves)
- ✅ Entire page is SSRed (both server and client components)
- ✅ Async function can await data server-side
- ✅ Client components can exist lower in tree with "use client" directive
- ✅ Data fetches server-side → 200-250ms LCP

**Key difference**:
- **Traditional**: "use client" at root → all components become client components → go into client bundle → lazy-loaded components NOT SSRed → client-side data fetch
- **RSC**: No "use client" at root (server components) → go into RSC bundle → entire page SSRed → client components allowed lower in tree → server-side data fetch

## Web Vitals Targets

### Traditional (Optimized Lazy-Loading)
| Metric | Target |
|--------|--------|
| LCP | 500-600ms |
| CLS | 0.10-0.15 |
| INP | 80-100ms |

### RSC (Server-Side Fetch + Streaming)
| Metric | Target |
|--------|--------|
| LCP | 200-250ms |
| CLS | 0.02 |
| INP | 50-60ms |

## Database Schema

```
restaurants (50K)         - Root entity
hours (400K)             - Regular opening hours
special_hours (150K)     - Holidays/exceptions
reviews (2M)             - Customer ratings
menu_items (500K)        - Menu
orders (10M)             - **CRITICAL for 100-150ms latency**
order_lines (50M)        - Order line items
promotions (100K)        - Active discounts
```

**Critical Index**: `(restaurant_id, created_at)` on orders table for wait_time queries.

## API Endpoints (Shared)

All return JSON with `timestamp`.

- `GET /api/restaurants/:id/status` → { status } (20-30ms)
- `GET /api/restaurants/:id/wait_time` → { wait_time } (100-150ms) **[CRITICAL]**
- `GET /api/restaurants/:id/specials` → { promotions } (30-50ms)
- `GET /api/restaurants/:id/trending` → { items } (50-100ms)
- `GET /api/restaurants/:id/rating` → { average_rating, review_count } (20-40ms)

## Local Development

```bash
# Setup
bundle install && pnpm install
rails db:create db:migrate db:seed

# Run
rails server              # Port 3000
./bin/webpack-dev-server  # Port 8080

# Visit
http://localhost:3000/search      # Traditional
http://localhost:3000/search/rsc  # RSC
http://localhost:3000/dashboard   # Metrics
```

**Verify latency** (must be 100-150ms):
```bash
time curl http://localhost:3000/api/restaurants/1/wait_time
```

## Deployment

See Task 5 for full deployment guide (Docker, Heroku).

## Project Structure

```
app/
├── models/
│   ├── restaurant.rb          # Core domain model
│   ├── order.rb               # For wait_time calculations
│   └── ...
├── controllers/
│   ├── api/restaurants_controller.rb  # 5 API endpoints
│   └── dashboard_controller.rb
├── views/
│   └── restaurants/
│       ├── search.html.erb       # Traditional view
│       └── search_rsc.html.erb   # RSC view
└── javascript/
    ├── components/
    │   ├── restaurant/           # Display components (shared)
    │   ├── async/
    │   │   ├── traditional/      # Traditional async components
    │   │   └── rsc/              # RSC async components
    │   └── Dashboard.tsx
    └── entries/
        ├── search.tsx            # Traditional webpack entry
        └── search_rsc.tsx        # RSC webpack entry
config/
├── webpack/
│   ├── webpack.config.js     # Traditional
│   └── webpack.rsc.js        # RSC with loader
└── initializers/react_on_rails.rb
db/
├── migrate/
├── seeds.rb                  # Seeds 62M records
└── seed_scripts/
spec/ or test/               # RSpec, Jest, Playwright
```

## Technology Stack

- **Backend**: Rails 7.x, Ruby 3.2+, PostgreSQL 14+
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Bundling**: Webpack 5 (traditional), Webpack 5 + RSC loader (RSC)
- **Testing**: RSpec, Jest, Playwright
- **Monitoring**: Web Vitals API

## Key Files to Study

1. `IMPLEMENTATION_TASKS.md` - What to build and specifications
2. `tasks/Task_1_Setup_and_Database.md` - Database design details
3. `tasks/Task_2_Shared_Components_and_API.md` - Component patterns
4. `tasks/Task_3_Traditional_Version.md` - Traditional pattern examples
5. `tasks/Task_4_RSC_Version.md` - RSC pattern examples
6. `tasks/Task_5_Dashboard_and_Docs.md` - Dashboard & deployment

## Demo Walkthrough (for presenting to customers)

1. **Show problem**: `/search` with spinners loading, LCP ~500ms, CLS ~0.12
2. **Show solution**: `/search/rsc` complete immediately, LCP ~200ms, CLS ~0.02
3. **Show metrics**: `/dashboard` - charts showing improvement
4. **Explain difference**: "Same database, same components, only data fetching timing"

See Task 5 for full walkthrough script.

## Critical Success Factors

**Task 1.4 (Data Seeding)**: Must achieve 100-150ms wait_time query latency
- Small database = demo fails (no visible advantage)
- Realistic latency = demo succeeds (59% improvement is real)

**Task 2**: Display components must be 100% pure (no hooks, no fetching)
- Ensures reuse between versions
- Forces correct architectural patterns

**Tasks 3&4**: Must show identical visual output despite different data fetching
- Proves RSC isn't "magic"—it's just better timing

## FAQ

**Q: Why 10M orders?**
A: Creates natural 100-150ms query latency. Without it, demo fails.

**Q: Why the same webpack config for both versions?**
A: Both use the RSC webpack config which produces three bundles (client, server, RSC). Traditional version uses the client bundle, RSC version uses the RSC bundle.

**Q: Can I modify query latency?**
A: No—that defeats the demo's purpose.

**Q: What about caching?**
A: Not implemented. Goal is proving RSC advantage without caching complexity.

**Q: Can I use different data?**
A: Yes, keep 10M orders. Change restaurant names/cuisines as desired.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, demo guardrails, deployment notes, and PR expectations.

## Related Resources

- React 19 Server Components: https://react.dev/blog/2024/12/19/react-19
- react-on-rails: https://github.com/shakacode/react_on_rails
- See also: react-on-rails-starter-tanstack: https://github.com/shakacode/react-on-rails-starter-tanstack - a companion Rails 8 starter for building production apps with React on Rails Pro and TanStack.
- Web Vitals: https://web.dev/vitals/
- Streaming HTML: https://web.dev/rendering-on-the-web/

---

**Status**: Active demo app for React on Rails SSR, client, and RSC comparisons
**Next Step**: Run the demo locally, compare the routes, and open an issue or PR for improvements

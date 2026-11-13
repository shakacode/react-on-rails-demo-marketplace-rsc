# Task 2: Shared Components & API

> **Historical planning document.** This is the original proposal, not current operating instructions or a record of what shipped. Routes, commands, dataset sizes, performance targets, and checklists may be obsolete. Start with the [current README](../README.md).

**Time**: 12-16 hours
**Dependencies**: Task 1 (Database must be complete and seeded)
**Blocks**: Tasks 3 & 4 (Both versions use these components and endpoints)

---

## Overview

Create all display components and API endpoints shared by both Traditional and RSC versions. This is pure code reuse - created once, used twice.

---

## Deliverables

### 1. Display Components (100% Shared)

**Key Principle**: These components take data as props and render it. **NO hooks, NO state, NO data fetching.**

Create in `app/javascript/components/restaurant/`:

#### StatusBadge.tsx
```typescript
interface Props {
  status: 'open' | 'closed' | 'custom_hours';
}

export function StatusBadge({ status }: Props) {
  const colors = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-800',
    custom_hours: 'bg-yellow-100 text-yellow-800',
  };

  const labels = {
    open: 'Open Now',
    closed: 'Closed',
    custom_hours: 'Custom Hours',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
```

#### WaitTimeBadge.tsx
```typescript
interface Props {
  minutes: number;
}

export function WaitTimeBadge({ minutes }: Props) {
  return (
    <span className="text-sm font-medium text-gray-700">
      {minutes === 0 ? 'No Wait' : `${minutes} min wait`}
    </span>
  );
}
```

#### RatingBadge.tsx
```typescript
interface Props {
  rating: number;  // 0.0-5.0
  count: number;   // review count
}

export function RatingBadge({ rating, count }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      <span className="text-xl">⭐</span>
      <span className="text-xs text-gray-600">({count.toLocaleString()} reviews)</span>
    </div>
  );
}
```

#### SpecialsList.tsx
```typescript
interface Props {
  promotions: Promotion[];
}

export function SpecialsList({ promotions }: Props) {
  if (promotions.length === 0) return null;

  return (
    <div className="space-y-2">
      {promotions.map(promo => (
        <div key={promo.id} className="bg-blue-50 p-2 rounded">
          <div className="font-semibold text-sm text-blue-900">{promo.title}</div>
          <div className="text-xs text-blue-700">{promo.description}</div>
        </div>
      ))}
    </div>
  );
}
```

#### TrendingItems.tsx
```typescript
interface Props {
  items: MenuItem[];
}

export function TrendingItems({ items }: Props) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-600 uppercase">Trending</div>
      {items.map(item => (
        <div key={item.id} className="text-sm text-gray-700">
          {item.name} ${item.price.toFixed(2)}
        </div>
      ))}
    </div>
  );
}
```

#### RestaurantCardHeader.tsx
```typescript
interface Props {
  restaurant: Restaurant;
}

export function RestaurantCardHeader({ restaurant }: Props) {
  return (
    <div className="mb-4">
      <img
        src={restaurant.image_url}
        alt={restaurant.name}
        className="w-full h-48 object-cover rounded-lg mb-3"
      />
      <h3 className="text-lg font-bold">{restaurant.name}</h3>
      <p className="text-sm text-gray-600">{restaurant.cuisine_type}</p>
      <p className="text-xs text-gray-500">{restaurant.city}, {restaurant.state}</p>
    </div>
  );
}
```

#### RestaurantCardFooter.tsx
```typescript
interface Props {
  restaurant: Restaurant;
}

export function RestaurantCardFooter({ restaurant }: Props) {
  return (
    <div className="pt-3 border-t border-gray-200">
      <RatingBadge rating={restaurant.average_rating} count={restaurant.review_count} />
      <p className="text-xs text-gray-500 mt-2">
        {getDistance(restaurant.latitude, restaurant.longitude)} away
      </p>
    </div>
  );
}
```

### 2. Static Content Components

Create in `app/javascript/components/search/`:

#### SearchHeader.tsx
```typescript
export function SearchHeader() {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-2">Find Restaurants</h1>
      <p className="text-gray-600">Discover local restaurants and real-time wait times</p>
      <input
        type="search"
        placeholder="Search by cuisine, location..."
        className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
    </div>
  );
}
```

#### RestaurantGrid.tsx
```typescript
interface Props {
  restaurants: Restaurant[];
  children: (restaurant: Restaurant) => React.ReactNode;
}

export function RestaurantGrid({ restaurants, children }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {restaurants.map(restaurant => (
        <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-6">
          {children(restaurant)}
        </div>
      ))}
    </div>
  );
}
```

### 3. Types File

Create `app/javascript/types/index.ts`:

```typescript
export interface Restaurant {
  id: number;
  name: string;
  description: string;
  cuisine_type: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  website_url: string;
  timezone: string;
  average_rating: number;
  review_count: number;
  image_url: string;
}

export interface StatusData {
  status: 'open' | 'closed' | 'custom_hours';
  message?: string;
}

export interface WaitTimeData {
  wait_time: number; // minutes
}

export interface Promotion {
  id: number;
  restaurant_id: number;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_item';
  discount_value: number;
  code?: string;
  starts_at: string;
  ends_at: string;
}

export interface MenuItem {
  id: number;
  restaurant_id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  prep_time_minutes: number;
}

export interface Review {
  id: number;
  restaurant_id: number;
  rating: number;
  title: string;
  comment: string;
  reviewer_name: string;
}
```

---

## API Endpoints

Create in `app/controllers/api/restaurants_controller.rb`:

### GET /api/restaurants/:id/status

**Returns**: Current open/closed status

```ruby
def status
  restaurant = Restaurant.find(params[:id])

  render json: {
    status: restaurant.current_status,
    timestamp: Time.current.iso8601
  }
end

# Example response:
# {
#   "status": "open",
#   "timestamp": "2024-12-19T20:41:00Z"
# }
```

**Latency target**: 20-30ms

---

### GET /api/restaurants/:id/wait_time

**Returns**: Current wait time in minutes

```ruby
def wait_time
  restaurant = Restaurant.find(params[:id])

  render json: {
    wait_time: restaurant.current_wait_time,
    timestamp: Time.current.iso8601
  }
end

# Example response:
# {
#   "wait_time": 23,
#   "timestamp": "2024-12-19T20:41:00Z"
# }
```

**Latency target**: 100-150ms (THIS IS CRITICAL - Proves realistic latency)

---

### GET /api/restaurants/:id/specials

**Returns**: Active promotions

```ruby
def specials
  restaurant = Restaurant.find(params[:id])

  render json: {
    promotions: restaurant.active_promotions.map { |p|
      {
        id: p.id,
        title: p.title,
        description: p.description,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        code: p.code,
        ends_at: p.ends_at.iso8601
      }
    },
    timestamp: Time.current.iso8601
  }
end

# Example response:
# {
#   "promotions": [
#     {"id": 1, "title": "20% Off", "description": "All food", ...}
#   ],
#   "timestamp": "2024-12-19T20:41:00Z"
# }
```

**Latency target**: 30-50ms

---

### GET /api/restaurants/:id/trending

**Returns**: Top 3 trending items

```ruby
def trending
  restaurant = Restaurant.find(params[:id])

  render json: {
    items: restaurant.trending_items.map { |item|
      {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description
      }
    },
    timestamp: Time.current.iso8601
  }
end

# Example response:
# {
#   "items": [
#     {"id": 123, "name": "Burger", "price": 12.99, ...},
#     {"id": 124, "name": "Pizza", "price": 9.99, ...},
#     {"id": 125, "name": "Salad", "price": 8.99, ...}
#   ],
#   "timestamp": "2024-12-19T20:41:00Z"
# }
```

**Latency target**: 50-100ms

---

### GET /api/restaurants/:id/rating

**Returns**: Average rating and review count

```ruby
def rating
  restaurant = Restaurant.find(params[:id])

  render json: {
    average_rating: restaurant.reviews.average(:rating).round(2),
    review_count: restaurant.reviews.count,
    timestamp: Time.current.iso8601
  }
end

# Example response:
# {
#   "average_rating": 4.5,
#   "review_count": 1234,
#   "timestamp": "2024-12-19T20:41:00Z"
# }
```

**Latency target**: 20-40ms

---

## Routes

Create in `config/routes.rb`:

```ruby
Rails.application.routes.draw do
  # View routes (for both versions)
  get '/search', to: 'restaurants#search'
  get '/search/rsc', to: 'restaurants#search_rsc'

  # API routes
  namespace :api do
    resources :restaurants, only: [] do
      member do
        get :status
        get :wait_time
        get :specials
        get :trending
        get :rating
      end
    end
  end

  # Health check
  get '/health', to: 'health#check'
end
```

---

## Styling Setup

Create `app/javascript/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom design tokens */
:root {
  --color-primary: #f97316; /* Orange for restaurants */
  --color-success: #22c55e; /* Green for open */
  --color-danger: #ef4444;  /* Red for closed */
  --color-warning: #eab308; /* Yellow for closing soon */
}

/* Component styles */
.card {
  @apply bg-white rounded-lg shadow-md p-6;
}

.badge {
  @apply inline-block px-3 py-1 rounded-full text-sm font-semibold;
}

.spinner {
  @apply animate-spin h-5 w-5 text-gray-400;
}
```

---

## Design System

Create `app/javascript/utils/design-tokens.ts`:

```typescript
export const colors = {
  primary: '#f97316',    // Restaurant orange
  success: '#22c55e',    // Open green
  danger: '#ef4444',     // Closed red
  warning: '#eab308',    // Closing yellow
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'Menlo, Courier, monospace',
  },
};
```

---

## Key Files to Create

```
app/javascript/components/
├─ restaurant/
│  ├─ StatusBadge.tsx
│  ├─ WaitTimeBadge.tsx
│  ├─ RatingBadge.tsx
│  ├─ SpecialsList.tsx
│  ├─ TrendingItems.tsx
│  ├─ RestaurantCardHeader.tsx
│  └─ RestaurantCardFooter.tsx
├─ search/
│  ├─ SearchHeader.tsx
│  └─ RestaurantGrid.tsx
└─ types/
   └─ index.ts

app/javascript/styles/
├─ globals.css
└─ components.css

app/javascript/utils/
├─ design-tokens.ts
└─ api.ts (for fetch helpers - Task 3 & 4)

app/controllers/
└─ api/
   └─ restaurants_controller.rb

config/
└─ routes.rb
```

---

## Success Criteria

### Must Have ✅

- [ ] All 7 display components created and typed
- [ ] All 5 API endpoints working and returning correct JSON
- [ ] Routes configured for both `/search` and `/search/rsc`
- [ ] All components are pure functions (no hooks/state)
- [ ] TypeScript compilation succeeds
- [ ] Tailwind styling applied and looking polished

### API Performance ⚡

- [ ] GET `/api/restaurants/:id/status` returns in 20-30ms
- [ ] GET `/api/restaurants/:id/wait_time` returns in 100-150ms ✨ (CRITICAL)
- [ ] GET `/api/restaurants/:id/specials` returns in 30-50ms
- [ ] GET `/api/restaurants/:id/trending` returns in 50-100ms
- [ ] GET `/api/restaurants/:id/rating` returns in 20-40ms
- [ ] All 5 endpoints called in parallel total ~150-200ms

### Code Quality

- [ ] All components have TypeScript props interfaces
- [ ] No linting errors (eslint, prettier)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility score >90 (a11y)
- [ ] No console warnings or errors

---

## Important Notes

### Display Components are Dumb

Components take data as props:

```typescript
// ✅ CORRECT - Pure component
export function StatusBadge({ status }: Props) {
  return <span>{labels[status]}</span>;
}

// ❌ WRONG - Fetching data
export function StatusBadge({ restaurantId }: Props) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}/status`)
      .then(r => r.json())
      .then(d => setStatus(d));
  }, [restaurantId]);
  return <span>{status}</span>;
}
```

Only BOTH versions use the same display components. Data fetching differs:
- **Traditional** (Task 3): `lazy()` + `useEffect` + `fetch()`
- **RSC** (Task 4): `async function` + `getReactOnRailsAsyncProp`

### API Response Format

All API responses should include:
- Main data field
- `timestamp` for debugging

```json
{
  "wait_time": 23,
  "status": 200,
  "timestamp": "2024-12-19T20:41:00Z"
}
```

### Styling Philosophy

- Use Tailwind utilities directly in JSX
- Keep design tokens in TypeScript
- No CSS-in-JS (Tailwind handles all styling)
- Dark mode optional (can add later)

---

## Handoff Criteria

This task is complete when:

- [ ] All display components render correctly
- [ ] All API endpoints tested and return expected data
- [ ] API latencies match targets (especially wait_time: 100-150ms)
- [ ] Components are fully typed with TypeScript
- [ ] Design looks professional and polished

**Next task**: Tasks 3 & 4 (Traditional & RSC versions) - Can run in parallel

---

## Testing

```typescript
// Component rendering test
describe('StatusBadge', () => {
  it('renders "Open Now" for open status', () => {
    const { getByText } = render(<StatusBadge status="open" />);
    expect(getByText('Open Now')).toBeInTheDocument();
  });
});

// API endpoint test
describe('GET /api/restaurants/:id/status', () => {
  it('returns status for restaurant', async () => {
    const response = await fetch('/api/restaurants/1/status');
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toMatch(/open|closed|custom_hours/);
  });

  it('responds in <30ms', async () => {
    const start = performance.now();
    await fetch('/api/restaurants/1/status');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });
});
```

---

## Resources

- Tailwind CSS: https://tailwindcss.com/docs
- React TypeScript: https://react-typescript-cheatsheet.netlify.app/
- Rails API: https://guides.rubyonrails.org/api_app.html

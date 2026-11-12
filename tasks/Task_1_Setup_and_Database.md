# Task 1: Setup & Database

> **Historical planning document.** This is the original proposal, not current operating instructions or a record of what shipped. Routes, commands, dataset sizes, performance targets, and checklists may be obsolete. Start with the [current README](../README.md).

**Time**: 8-12 hours
**Dependencies**: None (this is foundation)
**Blocking**: All other tasks depend on this

---

## Overview

Create a functional Rails 7.x app with TypeScript, React 19, and a realistic PostgreSQL database with 62M records. The database must naturally create 100-150ms query latencies to prove RSC streaming advantage.

---

## Deliverables

### 1. Rails Application Setup

**Create Rails app with**:
- Rails 7.1+
- PostgreSQL 14+
- TypeScript support
- React 19 (via react-on-rails)
- Tailwind CSS
- RSpec for testing
- Pre-commit hooks (rubocop, eslint, prettier)

**Key files**:
- `Gemfile` - with react-on-rails, rspec, factory_bot, pg
- `package.json` - with React 19, TypeScript, Tailwind
- `tsconfig.json` - strict mode enabled
- `tailwind.config.js` - configured for app
- `config/initializers/react_on_rails.rb` - configured
- `.env.example` - environment variables

**Commands to work**:
```bash
rails server                    # Starts on port 3000
rails db:create                 # Creates PostgreSQL database
npx webpack --version           # Webpack available
npx tsc --noEmit                # TypeScript compilation works
```

---

### 2. Database Schema (8 Tables)

Create migrations for all tables. **Critical**: Order matters because of foreign keys.

**Tables** (in order):
1. `restaurants` (50K records) - Root entity
2. `hours` (400K) - Regular opening hours
3. `special_hours` (150K) - Holiday/exception hours
4. `reviews` (2M) - Customer ratings
5. `menu_items` (500K) - Menu for each restaurant
6. `orders` (10M) - **CRITICAL**: Historical orders for wait time calculation
7. `order_lines` (50M) - Items within orders
8. `promotions` (100K) - Active discounts

**Schema specifications**:

```sql
restaurants (50K)
├─ id BIGINT PRIMARY KEY
├─ name, description, cuisine_type
├─ latitude, longitude, address, city, state, zip_code, phone, website
├─ timezone (important for status checking)
├─ average_rating DECIMAL(3,2), review_count INTEGER
└─ indexes: city, cuisine_type, average_rating

hours (400K)
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ day_of_week INTEGER (0-6: Sunday-Saturday)
├─ opens_at TIME, closes_at TIME
├─ is_closed BOOLEAN
└─ index: (restaurant_id, day_of_week)

special_hours (150K)
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ date DATE
├─ opens_at TIME, closes_at TIME
├─ is_closed BOOLEAN
├─ reason VARCHAR (holiday, event, etc)
└─ unique index: (restaurant_id, date)

reviews (2M)
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ rating INTEGER (1-5, CHECK constraint)
├─ title, comment, reviewer_name
└─ indexes: restaurant_id, (restaurant_id, created_at DESC)

menu_items (500K)
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ name, description, category
├─ price DECIMAL(8,2)
├─ prep_time_minutes INTEGER
├─ is_available BOOLEAN
└─ indexes: restaurant_id, (restaurant_id, category)

orders (10M) ⚠️ CRITICAL TABLE
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ order_number VARCHAR
├─ status VARCHAR (pending, preparing, ready, completed, cancelled)
├─ placed_at TIMESTAMP
├─ estimated_ready_time, actual_ready_time, completed_at TIMESTAMP
├─ total_price DECIMAL(10,2)
├─ is_delivery BOOLEAN
└─ indexes:
   ├─ (restaurant_id, created_at DESC) ← CRITICAL for wait_time
   ├─ (restaurant_id, status)
   └─ (restaurant_id, completed_at)

order_lines (50M)
├─ id BIGINT PRIMARY KEY
├─ order_id BIGINT (FK → orders CASCADE)
├─ menu_item_id BIGINT (FK → menu_items RESTRICT)
├─ quantity INTEGER
├─ price_per_unit DECIMAL(8,2)
├─ special_instructions TEXT
└─ indexes: order_id, menu_item_id

promotions (100K)
├─ id BIGINT PRIMARY KEY
├─ restaurant_id BIGINT (FK → restaurants)
├─ title, description
├─ discount_type VARCHAR (percentage, fixed_amount, free_item)
├─ discount_value DECIMAL(8,2)
├─ code VARCHAR
├─ starts_at, ends_at TIMESTAMP
├─ is_active BOOLEAN
└─ indexes: (restaurant_id, ends_at), (restaurant_id, starts_at, ends_at)
```

**Create migrations** (9 total):
```bash
db/migrate/001_create_restaurants.rb
db/migrate/002_create_hours.rb
db/migrate/003_create_special_hours.rb
db/migrate/004_create_reviews.rb
db/migrate/005_create_menu_items.rb
db/migrate/006_create_orders.rb          ← CRITICAL: 10M records
db/migrate/007_create_order_lines.rb     ← CRITICAL: 50M records
db/migrate/008_create_promotions.rb
db/migrate/009_add_critical_indexes.rb
```

---

### 3. Domain Models

Create Rails models with associations and query methods:

```ruby
# app/models/restaurant.rb
class Restaurant < ApplicationRecord
  has_many :hours
  has_many :special_hours
  has_many :reviews
  has_many :menu_items
  has_many :orders
  has_many :promotions

  # CRITICAL METHODS - These are what the API calls
  def current_status
    # Check special_hours first
    # Then check hours for current day
    # Return: "open" | "closed" | "custom_hours"
    # Latency target: 20-30ms
  end

  def current_wait_time
    # Query orders from last hour, calculate average prep time
    # Most expensive query - scans 10M rows
    # Return: minutes (integer)
    # Latency target: 100-150ms ← THIS IS CRITICAL
  end

  def trending_items
    # Query order_lines joined with menu_items
    # Count by menu_item, order by popularity
    # Return: top 3 MenuItem objects
    # Latency target: 50-100ms
  end

  def active_promotions
    # Query promotions where starts_at <= now <= ends_at
    # Return: Array[Promotion]
    # Latency target: 30-50ms
  end

  def average_rating
    # Aggregation over reviews table
    # Return: Float (0.0-5.0)
    # Latency target: 20-40ms
  end
end

# app/models/order.rb
class Order < ApplicationRecord
  belongs_to :restaurant
  has_many :order_lines
  has_many :menu_items, through: :order_lines
end

# app/models/review.rb
class Review < ApplicationRecord
  belongs_to :restaurant
  validates :rating, inclusion: 1..5
end

# app/models/menu_item.rb
class MenuItem < ApplicationRecord
  belongs_to :restaurant
  has_many :order_lines
end

# app/models/promotion.rb
class Promotion < ApplicationRecord
  belongs_to :restaurant
  scope :active, -> { where('starts_at <= ? AND ends_at >= ?', Time.current, Time.current) }
end

# app/models/hour.rb, special_hour.rb - Simple models
```

---

### 4. Data Seeding (CRITICAL)

**This determines if demo is credible.**

Create `db/seeds.rb` that:

```ruby
# Main seed file orchestrates:
1. Seed restaurants (50K)
2. Seed hours (400K)
3. Seed special_hours (150K)
4. Seed reviews (2M)
5. Seed menu_items (500K)
6. Seed promotions (100K)
7. Seed orders (10M) ← CRITICAL
8. Seed order_lines (50M) ← CRITICAL
9. Run VACUUM ANALYZE
10. Verify latencies with rake db:seed:verify
```

**Seeding approach**:

```ruby
# Use batch inserts for speed (not create one-by-one)
Restaurant.insert_all(restaurants_array, batch_size: 1000)

# For orders, distribute across restaurants realistically
restaurants.each do |restaurant|
  avg_orders = 10_000_000 / 50_000  # 200 per restaurant
  variance = rand(0.7..1.3)         # ±30% variance
  order_count = (avg_orders * variance).to_i

  orders = generate_orders_for(restaurant, order_count)
  Order.insert_all(orders, batch_size: 1000)
end

# Spread order timestamps across 24 months (not all recent)
created_at = rand(24.months.ago..Time.current)

# Create indexes AFTER seeding (faster than during)
# VACUUM ANALYZE to update statistics
```

**Timeline**:
- Target: Complete in <30 minutes
- 62M+ total records
- ~15-20 GB database size

**Verification** (create rake task):

```bash
rake db:seed:verify

# Output should show:
# ✅ Restaurants: 50,000
# ✅ Reviews: 2,000,000
# ✅ Orders: 10,000,000
# ✅ Order lines: 50,000,000
# ✅ current_status: 24ms (target: 20-30ms)
# ✅ current_wait_time: 142ms (target: 100-150ms) ← KEY METRIC
# ✅ trending_items: 78ms (target: 50-100ms)
# ✅ active_promotions: 35ms (target: 30-50ms)
# ✅ average_rating: 32ms (target: 20-40ms)
# ✅ All 5 queries in parallel: 178ms (target: 150-200ms)
```

---

## Success Criteria

### Must Have ✅

- [ ] `rails server` starts on port 3000 without errors
- [ ] `rails db:create db:migrate` succeeds
- [ ] All 9 migrations created and run successfully
- [ ] All 8 tables exist in PostgreSQL
- [ ] All foreign keys and indexes created
- [ ] All models with associations and methods defined
- [ ] `rails db:seed` completes in <30 minutes
- [ ] Database contains 62M+ records (within 5% variance)
- [ ] All record counts match targets (50K restaurants, 10M orders, etc.)

### Performance Requirements ⚡

- [ ] `restaurant.current_wait_time` takes **100-150ms** (CRITICAL)
- [ ] `restaurant.current_status` takes 20-30ms
- [ ] `restaurant.trending_items` takes 50-100ms
- [ ] `restaurant.active_promotions` takes 30-50ms
- [ ] `restaurant.reviews.average(:rating)` takes 20-40ms
- [ ] **All 5 queries in parallel take 150-200ms total** (not sequential!)

### Data Quality ✓

- [ ] No null foreign keys
- [ ] Restaurant ratings: 3.5-4.8 (realistic distribution)
- [ ] Orders spread across restaurants (min: 50, max: 500 per restaurant)
- [ ] Order dates span 24 months (not all recent)
- [ ] Wait times: 5-45 minutes (realistic)
- [ ] Menu item prices: $5-$30 (realistic)

---

## Key Files

```
app/models/
├─ restaurant.rb         (with current_status, current_wait_time, trending_items, etc.)
├─ order.rb
├─ review.rb
├─ menu_item.rb
├─ promotion.rb
├─ hour.rb
├─ special_hour.rb
└─ order_line.rb

db/migrate/
├─ 001_create_restaurants.rb
├─ 002_create_hours.rb
├─ 003_create_special_hours.rb
├─ 004_create_reviews.rb
├─ 005_create_menu_items.rb
├─ 006_create_orders.rb
├─ 007_create_order_lines.rb
├─ 008_create_promotions.rb
└─ 009_add_critical_indexes.rb

db/
├─ seeds.rb              (main orchestrator)
└─ seed_scripts/
   ├─ restaurants_seeder.rb
   ├─ hours_seeder.rb
   ├─ special_hours_seeder.rb
   ├─ reviews_seeder.rb
   ├─ menu_items_seeder.rb
   ├─ orders_seeder.rb   (CRITICAL)
   ├─ order_lines_seeder.rb
   └─ promotions_seeder.rb

lib/tasks/
└─ seed_verify.rake      (verification task)

config/
├─ database.yml          (PostgreSQL connection)
└─ initializers/react_on_rails.rb
```

---

## Critical Notes

### Why This Task is Blocking

Without realistic query latencies (100-150ms), **the entire demo fails**.

If `current_wait_time` query takes <50ms:
- Both versions load too fast
- RSC advantage isn't visible
- Demo is unconvincing

With realistic 100-150ms:
- Traditional version takes 500-600ms total (fetch latency)
- RSC version takes 200-250ms total (parallel server fetch)
- **59% improvement is dramatic and real**

### Data Seeding Tips

```ruby
# FAST: Batch inserts
Restaurant.insert_all(restaurants_array, batch_size: 5000)

# SLOW: One-by-one (avoid!)
restaurants_array.each { |r| Restaurant.create(r) }

# Use this for orders specifically:
Order.insert_all(orders, batch_size: 1000, ignore_duplicates: true)

# Force garbage collection to prevent OOM
GC.start if i % 100_000 == 0
```

### Testing Latency After Seeding

```ruby
# In rails console:
restaurant = Restaurant.first

# Measure status (should be <30ms)
time { restaurant.current_status }

# Measure wait time (should be 100-150ms)
time { restaurant.current_wait_time }

# If too fast, double-check:
# 1. Index was created (check schema)
# 2. VACUUM ANALYZE ran (refreshes statistics)
# 3. Orders have proper created_at distribution
```

---

## Handoff Criteria

This task is complete when:

- [ ] Database has 62M records
- [ ] `current_wait_time` consistently takes 100-150ms
- [ ] All models work with associations
- [ ] All query methods return correct data types
- [ ] Seed process documented and repeatable

**Next task**: Task 2 (Shared Components & API)

---

## Troubleshooting

### Q: Seeding takes >30 minutes
**A**: Check for `create` instead of `insert_all`. Disable validations during seed. Use batch_size of 5000+.

### Q: Queries still <50ms
**A**: Verify Order count: `Order.count` should be ~10M. Check indexes with `\d orders` in psql. Verify created_at distribution is across 24 months.

### Q: Foreign key constraint errors
**A**: Create tables in correct order. orders depends on restaurants. order_lines depends on both orders and menu_items.

### Q: Database size wrong
**A**: Should be 15-20 GB. If much smaller, recount records. If much larger, check for duplicate data.

### Q: Rails won't start
**A**: Check PostgreSQL running: `brew services start postgresql`. Check database.yml uses correct connection string.

---

## Resources

- Rails Migrations: https://guides.rubyonrails.org/active_record_migrations.html
- PostgreSQL Docs: https://www.postgresql.org/docs/14/
- Index Performance: https://use-the-index-luke.com/
- Web Vitals (coming in Task 5): https://web.dev/vitals/

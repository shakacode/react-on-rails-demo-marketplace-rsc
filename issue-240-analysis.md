# Issue #240 — Product Serializer Drift: Deep Analysis

> **Repo:** `shakacode/react-on-rails-demo-marketplace-rsc` at `88716fb`
> **Date:** 2026-09-12
> **Branch:** `240-five-independent-product-serializers`

---

## Executive Summary

The demo claims SSR and RSC render **the same data** so that measured performance differences are attributable to the rendering strategy alone. That claim rests on six independently written product serializers (the issue identified five; a sixth exists in `Api::ProductsController`) agreeing with each other. They don't.

The drift is worse than the issue describes:

- `specs` is serialized in search results for both SSR and RSC but **never rendered** by any search card component — it is dead payload included solely to support the parity claim.
- The `SearchProduct` TypeScript interface doesn't even declare a `specs` field.
- Review snippets differ across variants (rating threshold, comment truncation, count per product).
- Four locations in code comments and two in React component comments assert parity that does not exist.
- Zero automated tests verify payload parity between variants.

---

## The Six Serializers

### Serializer 1 — RSC inline (`search_rsc.html.erb`)

**File:** `app/views/product_search/search_rsc.html.erb`, lines 16–35
**Called by:** `ProductSearchController#search_rsc` (line 43) via `stream_view_containing_react_components`

| Field                 | Value                           |
| --------------------- | ------------------------------- |
| `id`                  | `p.id`                          |
| `name`                | `p.name`                        |
| `description`         | `p.description&.truncate(500)`  |
| `price`               | `p.price.to_f`                  |
| `original_price`      | `p.original_price&.to_f`        |
| `category`            | `p.category`                    |
| `brand`               | `p.brand`                       |
| `sku`                 | `p.sku`                         |
| `images`              | `p.images`                      |
| `features`            | `(p.features \|\| []).first(6)` |
| `tags`                | `p.tags \|\| []`                |
| `average_rating`      | `p.average_rating.to_f`         |
| `review_count`        | `p.review_count`                |
| `in_stock`            | `p.in_stock`                    |
| `stock_quantity`      | `p.stock_quantity`              |
| `discount_percentage` | `p.discount_percentage`         |
| `specs`               | `p.specs \|\| {}`               |

**17 fields.** Description truncated to **500 chars**. **6 features**. **Specs included.** Tags included.

Review snippets: 2 per product, `rating >= 3`, `verified_purchase = true`, comment truncated to 200 chars, ordered by `helpful_count DESC, created_at DESC`.

**Parity comment (lines 5–9):**

```ruby
#    Now includes the same rich data as SSR for a fair comparison:
#    - 500-char descriptions (same as SSR)
#    - 6 features per product (same as SSR)
#    - specs hash (same as SSR)
#    - 2 review snippets per product (same as SSR)
```

---

### Serializer 2 — RSC Cached inline (`search_rsc_cached.html.erb`)

**File:** `app/views/product_search/search_rsc_cached.html.erb`, lines 21–40
**Called by:** `ProductSearchController#search_rsc_cached` (line 56) via `cached_stream_react_component_with_async_props`

**Byte-for-byte clone of Serializer 1.** Same 17 fields, same truncation, same features, same specs, same tags, same review snippet logic.

Only difference: wrapped in `cached_stream_react_component_with_async_props` with `cache_key: ["product_search_rsc", @search_params_data.sort]`.

Same parity comment (lines 10–14).

---

### Serializer 3 — SSR controller method (`product_search_controller.rb`)

**File:** `app/controllers/product_search_controller.rb`, lines 133–159
**Method:** `serialize_search_result(product, rich: false)` (private)
**Called by:** `paginate_and_serialize` (line 102), which is called from:

- `search_ssr` (line 24) with `rich: true`
- `product_search_ssr_props` (line 64) with `rich: true` (used by `search_ssr_cached`)

| Field                 | Value                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| `id`                  | `product.id`                                                                       |
| `name`                | `product.name`                                                                     |
| `description`         | `product.description&.truncate(rich ? 500 : 200)`                                  |
| `price`               | `product.price.to_f`                                                               |
| `original_price`      | `product.original_price&.to_f`                                                     |
| `category`            | `product.category`                                                                 |
| `brand`               | `product.brand`                                                                    |
| `sku`                 | `product.sku`                                                                      |
| `images`              | `product.images`                                                                   |
| `features`            | `rich ? (product.features \|\| []).first(6) : (product.features \|\| []).first(3)` |
| `tags`                | `product.tags \|\| []`                                                             |
| `average_rating`      | `product.average_rating.to_f`                                                      |
| `review_count`        | `product.review_count`                                                             |
| `in_stock`            | `product.in_stock`                                                                 |
| `stock_quantity`      | `product.stock_quantity`                                                           |
| `discount_percentage` | `product.discount_percentage`                                                      |

**Conditional specs (lines 153–157):**

```ruby
if rich
  result[:specs] = product.specs || {}
end
```

**16 fields + conditional specs.** Since both callers pass `rich: true`, specs are always included in practice. Description: **500** (rich) / 200 (non-rich). Features: **6** (rich) / 3 (non-rich).

Review snippets: 2 per product via `load_review_snippets(per_product: 2)` — same SQL window function, `rating >= 3`, `verified_purchase = true`, comment truncated to 200 chars. **Functionally identical to the RSC inline SQL.**

> **Note:** `load_product_descriptions(truncate_at: 500)` (lines 161–164) re-truncates descriptions that are already truncated in `serialize_search_result`. This is a redundant double-truncation.

---

### Serializer 4 — API controller (`api/product_search_controller.rb`)

**File:** `app/controllers/api/product_search_controller.rb`, lines 71–89
**Method:** `serialize_product(product)` (private — shadows the concern's method)
**Called by:** `Api::ProductSearchController#results` (line 16), serving `GET /api/product_search/results`

| Field                 | Value                                 |
| --------------------- | ------------------------------------- |
| `id`                  | `product.id`                          |
| `name`                | `product.name`                        |
| `description`         | `product.description&.truncate(200)`  |
| `price`               | `product.price.to_f`                  |
| `original_price`      | `product.original_price&.to_f`        |
| `category`            | `product.category`                    |
| `brand`               | `product.brand`                       |
| `sku`                 | `product.sku`                         |
| `images`              | `product.images`                      |
| `features`            | `(product.features \|\| []).first(3)` |
| `tags`                | `product.tags \|\| []`                |
| `average_rating`      | `product.average_rating.to_f`         |
| `review_count`        | `product.review_count`                |
| `in_stock`            | `product.in_stock`                    |
| `stock_quantity`      | `product.stock_quantity`              |
| `discount_percentage` | `product.discount_percentage`         |

**16 fields. No `specs`. Description: 200 chars. Features: 3.** Tags included.

This controller does NOT include `ProductSerialization`. It defines its own `serialize_product` locally.

Review snippets: loaded separately via `POST /api/product_search/review_snippets` (lines 42–63). Uses `per_product: 1`, `rating >= 4` (different from ≥3), comment truncated to **150 chars** (different from 200).

No `filters_applied` in meta (SSR and RSC include it).

---

### Serializer 5 — Concern (`product_serialization.rb`)

**File:** `app/controllers/concerns/product_serialization.rb`, lines 12–19
**Method:** `serialize_product(product)` (private)
**Included by:** `ProductsController` only (not any search controller)

Uses `product.slice(...)` pattern:

| Field                 | Value                                   |
| --------------------- | --------------------------------------- |
| `id`                  | from slice                              |
| `name`                | from slice                              |
| `description`         | from slice — **no truncation**          |
| `category`            | from slice                              |
| `brand`               | from slice                              |
| `sku`                 | from slice                              |
| `images`              | from slice                              |
| `specs`               | from slice — **always included**        |
| `features`            | from slice — **all features, no limit** |
| `review_count`        | from slice                              |
| `stock_quantity`      | from slice                              |
| `in_stock`            | from slice                              |
| `price`               | `product.price.to_f`                    |
| `original_price`      | `product.original_price&.to_f`          |
| `average_rating`      | `product.average_rating.to_f`           |
| `discount_percentage` | `product.discount_percentage`           |

**16 fields. Full description. All features. Specs always. No `tags`.**

Additional methods:

- `serialize_review(review)` (lines 22–33): 8 fields, `created_at.iso8601`, **no comment truncation**
- `serialize_product_card(product)` (lines 35–42): 7 fields + 4 computed — slim card for related products

**Called from `ProductsController`:**

- `show_ssr`, `show_ssr_cached`, `show_ppr`: `serialize_product(product)` — full
- `show_rsc`, `show_rsc_cached`, `show_rsc_pull`: `serialize_product(@product).except(:description, :features, :specs)` — strips 3 fields for initial shell, streams them via async prop

---

### Serializer 6 — API Products controller (NOT in original issue)

**File:** `app/controllers/api/products_controller.rb`
**Does NOT include `ProductSerialization`.** Redefines locally:

- `serialize_review(review)` (lines 41–52): **Byte-identical** to the concern's version
- `serialize_product_card(product)` (lines 54–68): **Functionally equivalent** but uses explicit hash construction instead of `.slice` pattern

---

## Field-by-Field Drift Matrix

### Product Search Serializers

| Field                  | RSC (#1/#2) |  SSR rich (#3)   | API (#4) | Match? |
| ---------------------- | :---------: | :--------------: | :------: | :----: |
| description truncation |     500     |       500        | **200**  |   ❌   |
| features limit         |      6      |        6         |  **3**   |   ❌   |
| specs                  |     ✅      |  ✅ (rich only)  |  **❌**  |   ❌   |
| tags                   |     ✅      |        ✅        |    ✅    |   ✅   |
| field count            |     17      | 16+1 conditional |    16    |   ❌   |

### Review Snippets

| Aspect             | RSC (#1/#2) | SSR (#3)  |   API (#4)    | Match? |
| ------------------ | :---------: | :-------: | :-----------: | :----: |
| per product        |      2      |     2     |     **1**     |   ❌   |
| min rating         |     ≥ 3     |    ≥ 3    |    **≥ 4**    |   ❌   |
| comment truncation |  200 chars  | 200 chars | **150 chars** |   ❌   |

### Product Detail Serializers

| Field             | Concern (#5) | API Products (#6) |
| ----------------- | :----------: | :---------------: |
| description       |     Full     |  N/A (card only)  |
| features          |     All      |        N/A        |
| specs             |      ✅      |        N/A        |
| tags              |    **❌**    |        N/A        |
| review truncation |     None     |       None        |

---

## Dead Payload: `specs` in Search Results

**The `specs` field is serialized and sent over the wire in both SSR and RSC search results but never rendered.**

Evidence:

1. `SearchProduct` TypeScript interface (`app/javascript/components/product-search/types.ts`) does **not** declare a `specs` property.
2. `SearchResultCard.tsx` (168 lines) never reads or references `product.specs`.
3. The `Product` type (`app/javascript/types/product.ts`) does declare `specs: Record<string, string>`, but this type is for the product detail page, not search.
4. `specs` IS rendered on the product detail page via `ProductSpecs.tsx` (a table of key-value pairs), used by `ProductPageSSR`, `AsyncProductDetailsRSC`, and `AsyncProductDetailsPullRSC`.

**Impact:** Every search page load ships `specs` hashes for all 24 products — data that is serialized, transmitted, parsed, and discarded. It exists only to support the "same as SSR" comment.

---

## Every Parity Claim in the Codebase

### Claims that SSR and RSC send "the same data"

| #   | File                                                  | Lines | Claim                                                                  | Accurate?                                                                                                                                 |
| --- | ----------------------------------------------------- | ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `app/views/product_search/search_rsc.html.erb`        | 5–9   | "same rich data as SSR" including "specs hash (same as SSR)"           | ⚠️ RSC includes specs; SSR also includes specs when `rich: true`. But specs is **never rendered** in search — dead payload on both sides. |
| 2   | `app/views/product_search/search_rsc_cached.html.erb` | 10–14 | Identical claim                                                        | Same as above                                                                                                                             |
| 3   | `ProductSearchRSC.tsx`                                | 7–14  | "ALL the same features as SSR for a fair comparison" including "specs" | Same as above                                                                                                                             |
| 4   | `AsyncSearchResultsRSC.tsx`                           | 6–10  | "same data as SSR" including "specs (same as SSR)"                     | Same as above                                                                                                                             |
| 5   | `restaurants_controller.rb`                           | 47    | "RSC streaming — same payload as SSR"                                  | Not verified in this analysis (different page)                                                                                            |
| 6   | `README.md`                                           | 319   | "Must show identical visual output despite different data fetching"    | Visual parity claim, not data parity — reasonable                                                                                         |

### Claims that are factually wrong

The original issue text says the SSR path does **not** serialize `specs`. After deep analysis, this is **partially wrong** — the SSR `serialize_search_result` method DOES include `specs` when called with `rich: true` (line 153–157), and both callers pass `rich: true`. So the SSR and RSC search paths **do** serialize the same fields, including specs.

**However, the deeper problem remains:** `specs` is dead payload in search results — neither SSR nor RSC search cards render it. Both paths waste bandwidth shipping it. The parity comments are technically accurate (both include specs) but the field shouldn't be in either.

### The real drift (what's actually different)

The **client-fetch variant** (V2, Serializer #4) is the one that genuinely differs:

| Dimension                 |               SSR / RSC                |            Client (V2 API)             |
| ------------------------- | :------------------------------------: | :------------------------------------: |
| Description               |               500 chars                |               200 chars                |
| Features                  |                   6                    |                   3                    |
| Specs                     |           Included (unused)            |              Not included              |
| Review snippets           | 2/product, rating≥3, 200-char comments | 1/product, rating≥4, 150-char comments |
| Popular tags sidebar      |                   ✅                   |                   ❌                   |
| Brand highlights          |                   ✅                   |                   ❌                   |
| Empty state suggestions   |                   ✅                   |                   ❌                   |
| `filters_applied` in meta |                   ✅                   |                   ❌                   |

This means `/product-search/client` renders a visibly different, sparser experience than `/product-search/ssr` or `/product-search/rsc`.

---

## Benchmark Integrity Impact

### What BENCHMARKING.md and PERFORMANCE_EVIDENCE.md actually claim

- **BENCHMARKING.md** makes no claim about data parity between SSR/RSC. Its "fair comparison" reference (line 588) is about stable benchmarking conditions (LH CLI → cpln direct), not data content.
- **PERFORMANCE_EVIDENCE.md** compares Lighthouse scores, bundle sizes, and Web Vitals — not payload sizes or content.
- **Scripts** (`measure-vitals.mjs`, `measure-bundle-sizes.mjs`, etc.) measure timing and sizes but never compare actual payload content.

### What this means

The benchmark documents don't explicitly claim "same data", so they aren't technically wrong. But the demo's credibility as a fair comparison rests on an implicit assumption that all variants render equivalent content. The ERB/TSX comments make this assumption explicit — and while SSR/RSC search data is currently aligned (both include the same 17 fields), the alignment is fragile and maintained by copy-paste across three locations with zero automated verification.

---

## Pagination Overlap with Issue #239

The issue mentions that "the same four files also each contain their own copy of the pagination arithmetic (#239)." Confirmed:

- `product_search_controller.rb` lines 96–108: `PER_PAGE = 24`, `scope.offset((page - 1) * per_page).limit(per_page)`, manual total_pages calculation
- `api/product_search_controller.rb` lines 11–22: Same `PER_PAGE = 24`, same offset/limit pattern
- `search_rsc.html.erb`: Inline pagination arithmetic in the emit block
- `search_rsc_cached.html.erb`: Clone of above

Whoever consolidates the serializers will inevitably encounter the duplicated pagination. These two issues should be addressed together.

---

## Frontend Consumption: What's Actually Rendered

### Search Result Cards

`SearchResultCard.tsx` renders:

- `name` — product title
- `description` — client-side `slice(0, 300)` then `renderMarkdown()` (so server sends 500, card shows 300)
- `price`, `original_price` — with discount badge
- `images` — first image as card thumbnail
- `average_rating` — via `CardStarRating` (client island in RSC)
- `review_count` — review count badge
- `in_stock` — stock status indicator
- `features` — via `CardFeaturesList` with green checkmarks, `line-clamp-1`
- `tags` — via `CardProductTags`, sliced to first 3: `tags.slice(0, 3)`
- `discount_percentage` — discount badge

**NOT rendered:** `specs`, `sku`, `stock_quantity`, `brand`, `category` (though brand/category appear in facets)

### Product Detail Pages

All variants ultimately render: name, description (full markdown), price, original_price, images (gallery), features (grid), specs (table), average_rating, review_count, reviews list, related products.

RSC strips `description`, `features`, `specs` from initial props and streams them via async prop for progressive rendering.

---

## Component Tree Differences

### SSR Search (`ProductSearchSSR`)

Everything is `'use client'` — entire tree hydrates. All data arrives in the initial HTML.

### RSC Search (`ProductSearchRSC`)

Server component tree with four `<Suspense>` boundaries streaming independently:

1. `AsyncFacetsRSC` — filters sidebar
2. `AsyncSidebarExtrasRSC` — popular tags + brand highlights
3. `AsyncSearchResultsRSC` — product grid + pagination
4. (Compare bar is a client island)

Individual card elements (`CompareButton`, `AddToCartButton`, `CardStarRating`, `CardReviewSnippets`, `CardFeaturesList`, `CardProductTags`) are client islands injected via render props.

### Client Search (`ProductSearchClient`)

Shell renders immediately; data fetched via three API calls:

- `GET /api/product_search/results` — products + pagination
- Facets built from results client-side
- `POST /api/product_search/review_snippets` — review snippets (separate request)

No popular tags, no brand highlights, no empty-state suggestions, no `filters_applied`.

---

## What Needs to Happen (Scope from Issue)

### 1. Single source of truth for product serialization

Currently: 3 independent serialization paths for search (RSC inline × 2, SSR controller method, API controller method) + 1 concern for detail pages + 1 API products controller copy.

Target: One method/module with explicit variant options:

```ruby
# Pseudocode
serialize_product(product, variant: :search_rich)  # SSR/RSC search
serialize_product(product, variant: :search_card)   # API/client search
serialize_product(product, variant: :detail)         # Product detail page
serialize_product(product, variant: :card)           # Related product cards
```

### 2. Resolve the `specs` and truncation differences deliberately

Options:

- **Remove `specs` from search serialization entirely** (it's never rendered in search cards) and update the parity comments
- **Add `specs` to the client variant too** if the goal is true parity (but it's still not rendered)
- **Render `specs` in search cards** if there's a UI reason to include the data

For truncation: decide whether 200 or 500 is the right description length for each variant and document why.

### 3. Spec that fails when payloads diverge

A request spec that:

1. Hits each search variant for the same query
2. Extracts the product data from each response
3. Asserts field-set equality (or documents intentional differences)

### 4. Correct comments

Update all six parity-claim locations to reflect whatever is actually true after consolidation.

---

## File Inventory

All files that need changes:

| File                                                                 | Reason                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `app/views/product_search/search_rsc.html.erb`                       | Inline serializer → extract to shared method; fix parity comment    |
| `app/views/product_search/search_rsc_cached.html.erb`                | Same as above (clone)                                               |
| `app/controllers/product_search_controller.rb`                       | `serialize_search_result` → shared method; remove double-truncation |
| `app/controllers/api/product_search_controller.rb`                   | `serialize_product` → shared method; align or document differences  |
| `app/controllers/concerns/product_serialization.rb`                  | Expand to be the single source of truth                             |
| `app/controllers/api/products_controller.rb`                         | Include concern instead of local copies                             |
| `app/javascript/components/product-search/types.ts`                  | Add `specs` if keeping it, or remove from serialization             |
| `app/javascript/components/product-search/ProductSearchRSC.tsx`      | Fix parity comment                                                  |
| `app/javascript/components/product-search/AsyncSearchResultsRSC.tsx` | Fix parity comment                                                  |
| New: `spec/requests/serialization_parity_spec.rb`                    | Parity enforcement spec                                             |

---

## Appendix: Review Snippet Drift Detail

| Aspect                   |       SSR/RSC `per_product: 2`        |         API `per_product: 1`          |     SSR `per_product: 1` (unused)     |
| ------------------------ | :-----------------------------------: | :-----------------------------------: | :-----------------------------------: |
| SQL strategy             |    Window function `ROW_NUMBER()`     |             `DISTINCT ON`             |           Separate subquery           |
| Min rating               |                  ≥ 3                  |                  ≥ 4                  |                  ≥ 4                  |
| Comment truncation       |               200 chars               |               150 chars               |               150 chars               |
| Ordering                 | `helpful_count DESC, created_at DESC` | `helpful_count DESC, created_at DESC` | `helpful_count DESC, created_at DESC` |
| Verified purchase filter |                  ✅                   |                  ✅                   |                  ✅                   |
| Count per product        |                   2                   |                   1                   |                   1                   |

The `per_product: 1` path in `product_search_controller.rb` (lines 170–185) is dead code — never called with `per_product: 1` from the search actions (always called with `per_product: 2`).

# PPR-style product page experiment (issue #113)

Issue: [#113](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/113)

Branch: `113-ppr-experimental` | Date: 2026-07-01

## Goal

Add a product-page experiment that models a PPR split inside the existing React
on Rails RSC demo without introducing a full Next-style `use cache`
runtime/transport.

This spike is intentionally narrower than "real" Partial Prerendering:

- no React 19 `prerender()` / `resume()` transport
- no CDN-served static shell
- no full-page static artifact
- no attempt to re-create Next.js PPR semantics inside the gem/runtime

Instead, the route demonstrates the key design idea: a mostly-stable shell with
request-live holes that stream independently.

## Implemented route

- Route: `/product/ppr`
- Controller action: `ProductsController#show_ppr`
- React server component: `ProductPagePPR`

## Static vs dynamic split

The page is divided along data-stability lines rather than visual lines.

### Static editorial shell

Wrapped in `unstable_cache` inside `ProductPagePPR`:

- product description
- product features
- product specs table
- long-form spec sheet / markdown render

Important detail: the cache input is narrowed to the editorial fields actually
used by this section:

- `name`
- `price`
- `sku`
- `description`
- `features`
- `specs`

That avoids keying the static section on unrelated live values like stock count
or review count.

### Live dynamic holes

Still emitted per request through async props:

- `review_stats`
- `reviews`
- `related_products`

These remain behind Suspense boundaries so the route still exercises streamed
hole filling rather than replaying one monolithic cached page response.

## Why this is "PPR-style" and not full PPR

This route demonstrates a **static/dynamic boundary** on the same page, but it
does not prove the full operational benefits associated with framework-native
PPR:

- the first request still goes to Rails, not a CDN shell
- the static shell is cached at the server-component boundary, not pre-emitted
  as a standalone document
- resume semantics are not part of this experiment
- warm hits still participate in the existing React on Rails streaming pipeline

So the experiment is useful for understanding boundary placement and cache-key
design, but not as a full PPR performance claim.

## Verification evidence

Live route checks on 2026-07-01:

- `/product/ppr` returned `HTTP 200`
- rendered title: `Product Page — Experimental PPR-style RSC`
- rendered section labels:
  - `Cached Static Editorial Shell`
  - `Live Dynamic Holes`
- emitted RSC payload buffer:
  - `REACT_ON_RAILS_RSC_PAYLOADS`
- emitted Suspense templates for streamed sections

Focused validation:

- `bundle exec rspec spec/products_ppr_split_spec.rb spec/products_ppr_routing_spec.rb`
- `pnpm exec tsc --noEmit`
- `pnpm exec eslint app/javascript/components/product/ProductPagePPR.tsx app/javascript/startup/ProductPageRSC.tsx`
- `bin/shakapacker --mode development`

## Timing snapshot

Development-mode curl timings after warmup, same machine, unthrottled:

| Route | Warm sample TTFB range | Warm sample total range |
|---|---:|---:|
| `/product/ppr` | 189-288 ms | 229-551 ms |
| `/product/rsc` | 212-371 ms | 223-544 ms |
| `/product/rsc-cached` | 190-311 ms | 286-393 ms |

What this shows:

- the experiment works
- the new route is in the same rough latency band as the existing RSC variants
- this run does **not** show a decisive warm-path speed win for the PPR-style
  route in dev mode

That is acceptable for this spike. The point of issue #113 is the shape of the
experiment and the explicit boundary, not proof that this transport-free version
beats the existing cached page path.

## Conclusion

Issue #113 is viable as an experimental demo route.

It is useful for:

- showing how to place a static/dynamic boundary
- demonstrating `unstable_cache` on a page subsection
- comparing shell-first streaming behavior against existing product variants

It should not be described as production-ready PPR or as evidence that React on
Rails now implements framework-native Partial Prerendering.

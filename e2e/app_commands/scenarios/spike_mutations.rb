# frozen_string_literal: true

# Deterministic fixture for the #245 read-your-writes journey
# (e2e/playwright/e2e/product_review_mutation.spec.ts): one product — created
# first so /product/rsc's Product.first! resolves to it — with a known review
# ledger the mutation island's canned POST (helpful_count 500) always outranks
# in the top_reviews(5) window both render doors stream from.
E2EProductCleanup.clean!
E2ERestaurantCleanup.clean!

now = Time.zone.local(2026, 7, 18, 0, 0, 0)

product = Product.create!(
  name: 'E2E Mutation Headphones',
  description: 'E2E Mutation Headphones make read-your-writes observable.',
  price: 199,
  original_price: 249,
  category: 'E2E Product Page',
  brand: 'E2E Test Brand',
  sku: 'E2E-MUTATION-PAGE',
  images: [
    { url: '/seed-images/placeholder.svg', alt: 'E2E mutation headphones front', position: 1 }
  ],
  specs: { 'Connection' => 'USB-C', 'Warranty' => '2 years' },
  features: ['Deterministic fixture', 'Gated mutation island'],
  tags: ['e2e'],
  average_rating: 4.5,
  review_count: 2,
  stock_quantity: 3,
  in_stock: true,
  created_at: now,
  updated_at: now
)

ProductReview.create!(
  [
    {
      product: product,
      rating: 5,
      title: 'Deterministic before-state',
      comment: 'Seeded review one — visible before any mutation.',
      reviewer_name: 'E2E Reviewer One',
      verified_purchase: true,
      helpful_count: 10,
      created_at: now,
      updated_at: now
    },
    {
      product: product,
      rating: 4,
      title: 'Stable reviews window',
      comment: 'Seeded review two — the top-5 window never fills up.',
      reviewer_name: 'E2E Reviewer Two',
      verified_purchase: true,
      helpful_count: 5,
      created_at: now,
      updated_at: now
    }
  ]
)

# A sibling in the same category so related_products returns at least one row.
Product.create!(
  name: 'E2E Mutation Sibling',
  description: 'Deterministic sibling for the related-products rail.',
  price: 149,
  category: 'E2E Product Page',
  brand: 'E2E Test Brand',
  sku: 'E2E-MUTATION-SIBLING',
  images: [{ url: '/seed-images/placeholder.svg', alt: 'E2E sibling product', position: 1 }],
  specs: { 'Connection' => 'USB-C' },
  features: ['Deterministic fixture'],
  tags: ['e2e'],
  average_rating: 4.0,
  review_count: 0,
  stock_quantity: 10,
  in_stock: true,
  created_at: now,
  updated_at: now
)

{ product_id: product.id, products: Product.count, product_reviews: ProductReview.count }

# frozen_string_literal: true

E2EProductCleanup.clean!

now = Time.zone.local(2026, 7, 18, 0, 0, 0)
product_page = Product.create!(
  name: 'E2E Product Page Headphones',
  description: 'E2E Product Page Headphones deliver deterministic sound.',
  price: 199,
  original_price: 249,
  category: 'E2E Product Page',
  brand: 'E2E Test Brand',
  sku: 'E2E-PRODUCT-PAGE',
  images: [
    { url: '/seed-images/placeholder.svg', alt: 'E2E headphones front', position: 1 },
    { url: '/seed-images/placeholder.svg', alt: 'E2E headphones side', position: 2 }
  ],
  specs: { 'Connection' => 'USB-C', 'Warranty' => '2 years' },
  features: ['Deterministic fixture', 'Hydrated cart controls'],
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
      product: product_page,
      rating: 5,
      title: 'Excellent deterministic audio',
      comment: 'The repeatable fixture rendered every expected product section.',
      reviewer_name: 'E2E Reviewer One',
      verified_purchase: true,
      helpful_count: 10,
      created_at: now,
      updated_at: now
    },
    {
      product: product_page,
      rating: 4,
      title: 'Reliable browser journey',
      comment: 'Quantity and cart controls hydrate consistently.',
      reviewer_name: 'E2E Reviewer Two',
      verified_purchase: true,
      helpful_count: 5,
      created_at: now,
      updated_at: now
    }
  ]
)

Product.create!(
  name: 'E2E Unavailable Product',
  description: 'Deterministic unavailable product for the disabled purchase path.',
  price: 75,
  category: 'E2E Product Page',
  brand: 'E2E Test Brand',
  sku: 'E2E-PRODUCT-UNAVAILABLE',
  images: [{ url: '/seed-images/placeholder.svg', alt: 'Unavailable E2E product', position: 1 }],
  specs: { 'Availability' => 'Unavailable' },
  features: ['Deterministic fixture'],
  tags: ['e2e'],
  average_rating: 0,
  review_count: 0,
  stock_quantity: 0,
  in_stock: false,
  created_at: now,
  updated_at: now
)

products = (1..25).map do |number|
  {
    name: format('E2E Search Product %02d', number),
    description: "Deterministic E2E audio product #{number}",
    price: 100 + number,
    category: 'E2E Audio',
    brand: 'E2E Test Brand',
    sku: format('E2E-SEARCH-%02d', number),
    images: [],
    specs: { source: 'playwright' },
    features: ['Deterministic fixture'],
    tags: ['e2e'],
    average_rating: 4.5,
    review_count: 1_000 - number,
    stock_quantity: 50,
    in_stock: true,
    created_at: now,
    updated_at: now
  }
end

products << {
  name: 'E2E Search Camera',
  description: 'Deterministic E2E camera product',
  price: 250,
  category: 'E2E Cameras',
  brand: 'E2E Test Brand',
  sku: 'E2E-SEARCH-CAMERA',
  images: [],
  specs: { source: 'playwright' },
  features: ['Deterministic fixture'],
  tags: ['e2e'],
  average_rating: 4.5,
  review_count: 1,
  stock_quantity: 50,
  in_stock: true,
  created_at: now,
  updated_at: now
}

Product.create!(products)

{ products: Product.count, categories: Product.group(:category).count }

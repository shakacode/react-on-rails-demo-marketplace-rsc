# frozen_string_literal: true

E2EDatabaseSafety.verify!

now = Time.current
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

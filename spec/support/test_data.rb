# frozen_string_literal: true

# Lightweight, explicit builders for the handful of records the request specs
# need. Kept deliberately small (a few rows) so the suite stays fast and
# hermetic — it never depends on the heavy db/seeds.rb dataset.
module TestData
  module_function

  def create_product(category: 'Electronics', brand: 'Acme', price: 99.99, **attrs)
    Product.create!(
      {
        name: "Test Product #{SecureRandom.hex(4)}",
        description: 'A solid, dependable product used in request specs.',
        price: price,
        original_price: price + 50,
        category: category,
        brand: brand,
        sku: "SKU-#{SecureRandom.hex(6)}",
        images: [{ 'url' => 'https://example.com/p.jpg', 'alt' => 'Product' }],
        specs: { 'Weight' => '1kg' },
        features: ['Durable', 'Lightweight', 'Warranty included'],
        tags: %w[bestseller new],
        stock_quantity: 25,
        in_stock: true
      }.merge(attrs)
    )
  end

  # Adds `count` verified 5-star reviews (so they surface in review snippets /
  # top reviews) and refreshes the product's cached rating columns.
  def add_reviews(product, count: 3)
    count.times do |i|
      product.product_reviews.create!(
        rating: 5,
        title: "Great purchase ##{i + 1}",
        comment: 'Exceeded expectations. Would buy again.',
        reviewer_name: "Reviewer #{i + 1}",
        verified_purchase: true,
        helpful_count: 10 - i
      )
    end
    product.update_cached_rating!
    product
  end

  # A product with reviews and a sibling in the same category (so
  # `related_products` returns at least one row).
  def create_product_with_reviews(category: 'Electronics')
    product = create_product(category: category)
    add_reviews(product)
    create_product(category: category) # sibling for related_products
    product
  end

  def create_restaurant(**attrs)
    Restaurant.create!(
      {
        name: 'The Test Kitchen',
        description: 'A cozy spot used in request specs.',
        cuisine_type: 'Italian',
        city: 'Portland',
        state: 'OR',
        address: '123 Test St',
        phone: '555-0100',
        website: 'https://example.com',
        image_url: 'https://example.com/r.jpg',
        latitude: 45.5152,
        longitude: -122.6784,
        timezone: 'America/Los_Angeles'
      }.merge(attrs)
    )
  end
end

RSpec.configure do |config|
  config.include TestData, type: :request
end

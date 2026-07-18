ENV["RAILS_ENV"] ||= "test"

require_relative "../config/environment"
require "rspec/rails"

RSpec.describe ProductsController do
  around do |example|
    ProductReview.delete_all
    Product.delete_all
    example.run
  ensure
    ProductReview.delete_all
    Product.delete_all
  end

  it "keeps editorial product fields in the PPR shell props" do
    product = create_product!("PPR-CAM-001")

    shell_props = controller.send(:product_ppr_shell_props, product)

    expect(shell_props[:description]).to eq(product.description)
    expect(shell_props[:features]).to eq(product.features)
    expect(shell_props[:specs]).to eq(product.specs)
    expect(shell_props).not_to have_key(:review_stats)
    expect(shell_props).not_to have_key(:reviews)
    expect(shell_props).not_to have_key(:related_products)
  end

  it "keeps only live review and recommendation data in async holes" do
    product = create_product!("PPR-CAM-001")
    create_product!("PPR-REL-001", name: "Related Camera 1")
    create_product!("PPR-REL-002", name: "Related Camera 2")

    ProductReview.create!(
      product: product,
      rating: 5,
      title: "Excellent",
      comment: "Very fast autofocus.",
      reviewer_name: "Pat",
      verified_purchase: true,
      helpful_count: 4
    )
    product.update_cached_rating!

    async_payloads = controller.send(:product_ppr_async_payloads, product)

    expect(async_payloads.keys).to contain_exactly(:review_stats, :reviews, :related_products)
    expect(async_payloads).not_to have_key(:product_details)
    expect(async_payloads[:reviews][:reviews].size).to eq(1)
    expect(async_payloads[:related_products][:products].size).to eq(2)
    expect(async_payloads[:review_stats][:total_reviews]).to eq(product.review_count)
  end

  def controller
    @controller ||= described_class.new
  end

  def create_product!(sku, overrides = {})
    Product.create!(
      {
        name: "PPR Demo Camera #{sku}",
        description: "Static shell copy for #{sku}",
        price: 299.0,
        original_price: 349.0,
        category: "Cameras",
        brand: "ShakaCam",
        sku: sku,
        images: [{ url: "/#{sku.downcase}.jpg", alt: sku, position: 1 }],
        specs: { "Sensor" => "Full Frame" },
        features: ["4K video", "Weather sealed"],
        stock_quantity: 12,
        in_stock: true,
        average_rating: 4.5,
        review_count: 3
      }.merge(overrides)
    )
  end
end

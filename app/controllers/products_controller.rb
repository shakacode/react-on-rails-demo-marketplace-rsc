# frozen_string_literal: true

class ProductsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:show_rsc]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "show_ssr" => "Server-Side Rendering (SSR)",
    "show_client" => "Client-Side Rendering",
    "show_rsc" => "React Server Components (RSC)"
  }.freeze

  # V1: Full Server SSR — fetch ALL data, return complete page
  # All data must be ready before ANY HTML is sent to the browser.
  def show_ssr
    product = find_product

    # Sequential queries — each one blocks the response
    reviews = product.top_reviews(10)
    review_stats = product.review_stats
    related = product.related_products(4)

    @product_data = serialize_product(product)
    @reviews_data = reviews.map { |r| serialize_review(r) }
    @review_stats_data = review_stats
    @related_products_data = related.map { |p| serialize_product_card(p) }
  end

  # V2: Client Components — send basic product data, client fetches the rest
  def show_client
    @product_data = serialize_product(find_product)
  end

  # V3: RSC Streaming — shell streams immediately, heavy data streams as it resolves
  def show_rsc
    @product = find_product
    # Exclude description/features/specs from initial props — they stream via product_details
    # async prop to keep the initial shell small and prioritize LCP.
    @product_data = serialize_product(@product).except(:description, :features, :specs)
    stream_view_containing_react_components(template: "products/show_rsc")
  end

  private

  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    @page_title = "Product Page — #{variant} | React on Rails RSC Demo" if variant
    @page_description =
      "An e-commerce product page rendered three ways — comparing React Server " \
      "Components against SSR and client-side rendering in the React on Rails demo."
  end

  def hero_image_url
    @product_data&.dig(:images, 0, "url") || @product_data&.dig(:images, 0, :url)
  end
  helper_method :hero_image_url

  def find_product
    if params[:id]
      Product.find(params[:id])
    else
      Product.first!
    end
  end

  def serialize_product(product)
    {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.to_f,
      original_price: product.original_price&.to_f,
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      images: product.images,
      specs: product.specs,
      features: product.features,
      average_rating: product.average_rating.to_f,
      review_count: product.review_count,
      stock_quantity: product.stock_quantity,
      in_stock: product.in_stock,
      discount_percentage: product.discount_percentage
    }
  end

  def serialize_review(review)
    {
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      reviewer_name: review.reviewer_name,
      verified_purchase: review.verified_purchase,
      helpful_count: review.helpful_count,
      created_at: review.created_at.iso8601
    }
  end

  def serialize_product_card(product)
    {
      id: product.id,
      name: product.name,
      price: product.price.to_f,
      original_price: product.original_price&.to_f,
      category: product.category,
      brand: product.brand,
      images: product.images,
      average_rating: product.average_rating.to_f,
      review_count: product.review_count,
      in_stock: product.in_stock,
      discount_percentage: product.discount_percentage
    }
  end
end

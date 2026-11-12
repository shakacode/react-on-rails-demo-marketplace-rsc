# frozen_string_literal: true

module Api
  class ProductsController < ApplicationController
    include ProductSerialization

    skip_forgery_protection

    # GET /api/products/:id/reviews
    def reviews
      product = Product.find(params[:id])
      reviews = product.top_reviews(10)

      render json: {
        reviews: reviews.map { |r| serialize_review(r) },
        timestamp: Time.current.iso8601
      }
    end

    # GET /api/products/:id/review_stats
    def review_stats
      product = Product.find(params[:id])

      render json: {
        **product.review_stats,
        timestamp: Time.current.iso8601
      }
    end

    # GET /api/products/:id/related_products
    def related_products
      product = Product.find(params[:id])
      related = product.related_products(4)

      render json: {
        products: related.map { |p| serialize_product_card(p) },
        timestamp: Time.current.iso8601
      }
    end
  end
end

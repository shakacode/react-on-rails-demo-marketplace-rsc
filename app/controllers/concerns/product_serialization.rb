# frozen_string_literal: true

# Product hash serialization shared by the SSR / client / RSC product actions and their cached
# variants. Extracted from ProductsController to keep that controller focused on actions.
module ProductSerialization
  extend ActiveSupport::Concern

  private

  # Slice the plain columns (no custom getters) and merge the computed floats + the model's
  # overridden discount_percentage. Behavior-identical to the previous explicit hash.
  def serialize_product(product)
    product.slice(:id, :name, :description, :category, :brand, :sku, :images, :specs,
                  :features, :review_count, :stock_quantity, :in_stock).symbolize_keys.merge(
                    price: product.price.to_f,
                    original_price: product.original_price&.to_f,
                    average_rating: product.average_rating.to_f,
                    discount_percentage: product.discount_percentage
                  )
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
    product.slice(:id, :name, :category, :brand, :images, :review_count, :in_stock).symbolize_keys.merge(
      price: product.price.to_f,
      original_price: product.original_price&.to_f,
      average_rating: product.average_rating.to_f,
      discount_percentage: product.discount_percentage
    )
  end
end

# frozen_string_literal: true

# Single source of truth for product hash serialization.
#
# Supports four variants:
#   :search_rich — SSR/RSC search (500-char description, 6 features, NO specs)
#   :search_card — API/client search (aligned to match search_rich)
#   :detail      — Product detail page (full description, all features, specs, no tags)
#   :card        — Related product cards (slim card, no description/specs/features)
#
# Included by ProductSearchController, ProductsController, Api::ProductSearchController,
# and Api::ProductsController.
module ProductSerialization
  extend ActiveSupport::Concern

  private

  # ---------------------------------------------------------------------------
  # Search product serialization — the unified entry point for all search paths
  # ---------------------------------------------------------------------------

  def serialize_search_product(product, variant: :search_rich)
    case variant
    when :search_rich, :search_card
      {
        id: product.id,
        name: product.name,
        description: product.description&.truncate(500),
        price: product.price.to_f,
        original_price: product.original_price&.to_f,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
        images: product.images,
        features: (product.features || []).first(6),
        tags: product.tags || [],
        average_rating: product.average_rating.to_f,
        review_count: product.review_count,
        in_stock: product.in_stock,
        stock_quantity: product.stock_quantity,
        discount_percentage: product.discount_percentage
      }
    else
      raise ArgumentError, "Unknown search variant: #{variant.inspect}"
    end
  end

  # ---------------------------------------------------------------------------
  # Product detail serialization (product show pages)
  # ---------------------------------------------------------------------------

  def serialize_product(product)
    product.slice(:id, :name, :description, :category, :brand, :sku, :images, :specs,
                  :features, :review_count, :stock_quantity, :in_stock).symbolize_keys.merge(
                    price: product.price.to_f,
                    original_price: product.original_price&.to_f,
                    average_rating: product.average_rating.to_f,
                    discount_percentage: product.discount_percentage
                  )
  end

  # ---------------------------------------------------------------------------
  # Review serialization (product detail pages)
  # ---------------------------------------------------------------------------

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

  # ---------------------------------------------------------------------------
  # Slim card serialization (related product cards)
  # ---------------------------------------------------------------------------

  def serialize_product_card(product)
    product.slice(:id, :name, :category, :brand, :images, :review_count, :in_stock).symbolize_keys.merge(
      price: product.price.to_f,
      original_price: product.original_price&.to_f,
      average_rating: product.average_rating.to_f,
      discount_percentage: product.discount_percentage
    )
  end

  # ---------------------------------------------------------------------------
  # Review snippets for search results — consistent across all paths:
  #   2 per product, rating >= 3, comment truncated to 200 chars
  # ---------------------------------------------------------------------------

  def load_review_snippets(product_ids, per_product: 2)
    return {} if product_ids.empty?

    sql = <<~SQL
      SELECT product_id, title, rating, reviewer_name, comment, helpful_count
      FROM (
        SELECT product_id, title, rating, reviewer_name, comment, helpful_count,
               ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY helpful_count DESC, created_at DESC) as rn
        FROM product_reviews
        WHERE product_id IN (#{product_ids.map { |id| ActiveRecord::Base.connection.quote(id) }.join(',')})
          AND rating >= 3
          AND verified_purchase = true
      ) ranked
      WHERE rn <= #{per_product.to_i}
    SQL

    ActiveRecord::Base.connection.execute(sql).each_with_object({}) do |row, hash|
      pid = row['product_id']
      hash[pid] ||= []
      hash[pid] << {
        title: row['title'],
        rating: row['rating'],
        reviewer_name: row['reviewer_name'],
        comment: row['comment']&.truncate(200),
        helpful_count: row['helpful_count']
      }
    end
  end
end

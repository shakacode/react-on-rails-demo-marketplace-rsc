# frozen_string_literal: true

module Types
  class ProductType < BaseObject
    description "A product listing with full detail fields"

    field :id, ID, null: false
    field :name, String, null: false
    field :description, String
    field :price, Float, null: false
    field :original_price, Float
    field :category, String, null: false
    field :brand, String, null: false
    field :sku, String, null: false
    field :images, [ProductImageType], null: false
    field :specs, GraphQL::Types::JSON
    field :features, [String]
    field :average_rating, Float, null: false
    field :review_count, Integer, null: false
    field :stock_quantity, Integer, null: false
    field :in_stock, Boolean, null: false
    field :discount_percentage, Float

    # Associations — deliberately limited to top N to match existing serializer behaviour.
    field :reviews, [ProductReviewType], null: false, description: "Top reviews ordered by helpful_count" do
      argument :limit, Integer, required: false, default_value: 5
    end

    field :review_stats, ReviewStatsType, null: false

    field :related_products, [ProductCardType], null: false do
      argument :limit, Integer, required: false, default_value: 4
    end

    def price
      object.price.to_f
    end

    def original_price
      object.original_price&.to_f
    end

    def average_rating
      object.average_rating.to_f
    end

    def reviews(limit:)
      object.top_reviews(limit)
    end

    def review_stats
      object.review_stats
    end

    def related_products(limit:)
      object.related_products(limit)
    end
  end
end

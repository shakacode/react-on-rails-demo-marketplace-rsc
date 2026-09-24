# frozen_string_literal: true

module Types
  class ProductCardType < BaseObject
    description "Slim product card for related-products lists"

    field :id, ID, null: false
    field :name, String, null: false
    field :price, Float, null: false
    field :original_price, Float
    field :category, String, null: false
    field :brand, String, null: false
    field :images, [ProductImageType], null: false
    field :average_rating, Float, null: false
    field :review_count, Integer, null: false
    field :in_stock, Boolean, null: false
    field :discount_percentage, Float

    def price
      object.price.to_f
    end

    def original_price
      object.original_price&.to_f
    end

    def average_rating
      object.average_rating.to_f
    end
  end
end

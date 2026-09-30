# frozen_string_literal: true

module Types
  # A single product image with URL, alt text, and position.
  class ProductImageType < BaseObject
    field :url, String, null: false
    field :alt, String, null: false
    field :position, Integer, null: false
  end
end

# frozen_string_literal: true

module Types
  class ProductImageType < BaseObject
    field :url, String, null: false
    field :alt, String, null: false
    field :position, Integer, null: false
  end
end

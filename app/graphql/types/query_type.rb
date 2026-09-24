# frozen_string_literal: true

module Types
  class QueryType < BaseObject
    description "Root query type"

    field :product, ProductType, "Find a product by ID (defaults to the first product)" do
      argument :id, ID, required: false
    end

    def product(id: nil)
      if id
        Product.find(id)
      else
        Product.first!
      end
    end
  end
end

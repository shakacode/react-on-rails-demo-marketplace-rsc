# frozen_string_literal: true

module Types
  class ProductReviewType < BaseObject
    field :id, ID, null: false
    field :rating, Integer, null: false
    field :title, String, null: false
    field :comment, String, null: false
    field :reviewer_name, String, null: false
    field :verified_purchase, Boolean, null: false
    field :helpful_count, Integer, null: false
    field :created_at, GraphQL::Types::ISO8601DateTime, null: false
  end
end

# frozen_string_literal: true

module Types
  # One row in the star-rating histogram (e.g. 5★ → 42 reviews, 60%).
  class RatingDistributionType < BaseObject
    field :stars, Integer, null: false
    field :count, Integer, null: false
    field :percentage, Float, null: false
  end

  # Aggregate review statistics: average rating, total count, and distribution.
  class ReviewStatsType < BaseObject
    field :average_rating, Float, null: false
    field :total_reviews, Integer, null: false
    field :distribution, [RatingDistributionType], null: false
  end
end

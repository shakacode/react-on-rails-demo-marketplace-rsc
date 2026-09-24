# frozen_string_literal: true

module Types
  class RatingDistributionType < BaseObject
    field :stars, Integer, null: false
    field :count, Integer, null: false
    field :percentage, Float, null: false
  end

  class ReviewStatsType < BaseObject
    field :average_rating, Float, null: false
    field :total_reviews, Integer, null: false
    field :distribution, [RatingDistributionType], null: false
  end
end

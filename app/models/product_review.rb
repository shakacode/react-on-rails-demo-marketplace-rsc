# frozen_string_literal: true

class ProductReview < ApplicationRecord
  belongs_to :product

  # Length caps (issue #245 security-pass residual): the write endpoint is
  # env-gated, but its inputs still get bounded so a stray oversized payload
  # cannot balloon rows or the streamed reviews props.
  validates :rating, presence: true, inclusion: { in: 1..5 }
  validates :reviewer_name, presence: true, length: { maximum: 100 }
  validates :title, length: { maximum: 200 }, allow_blank: true
  validates :comment, length: { maximum: 5000 }, allow_blank: true
end

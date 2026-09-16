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
  # Bounded like the strings (block-review finding): an out-of-range JSON
  # integer would otherwise blow past the 4-byte column at save time as a
  # 500 (ActiveModel::RangeError) instead of this 422.
  validates :helpful_count, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than: 2**31 },
                            allow_nil: true
end

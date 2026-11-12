# frozen_string_literal: true

# Keep eligible search snippets ordered without scanning each product's history.
class AddProductReviewSnippetIndex < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index :product_reviews, %i[product_id helpful_count created_at],
              name: 'index_product_reviews_for_search_snippets',
              order: { helpful_count: :desc, created_at: :desc },
              where: 'rating >= 3 AND verified_purchase = true',
              algorithm: :concurrently
  end
end

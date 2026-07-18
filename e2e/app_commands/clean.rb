# frozen_string_literal: true

E2EDatabaseSafety.verify!

ProductReview.delete_all
Product.delete_all
Rails.cache.clear

{ products: Product.count, product_reviews: ProductReview.count }

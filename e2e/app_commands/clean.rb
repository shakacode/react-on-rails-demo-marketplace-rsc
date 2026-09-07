# frozen_string_literal: true

E2EProductCleanup.clean!

{ products: Product.count, product_reviews: ProductReview.count }

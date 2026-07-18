# frozen_string_literal: true

E2EProductCleanup.clean!
E2ERestaurantCleanup.clean!

{ products: Product.count, product_reviews: ProductReview.count, restaurants: Restaurant.count }

# frozen_string_literal: true

# Write endpoint for the read-your-writes spike (issue #245): the
# ReviewMutationIsland client island on /product/rsc POSTs a canned review
# here, then asks its enclosing <RSCRoute> to refetch the RSC page.
#
# Success responses MUST be `render json:` — never `redirect_to`. Client-side
# fetches (useRailsForm and the spike island) run with `redirect: 'error'`, so
# a Rails redirect surfaces in the browser as an opaque TypeError.
class ProductReviewsController < ApplicationController
  include ReactOnRails::Controller::FormResponders

  def create
    product = Product.find(params[:product_id])
    review = product.product_reviews.new(review_params)

    if review.save
      render json: { id: review.id }, status: :created
    else
      render_model_errors(review)
    end
  end

  private

  # `verified_purchase` and `helpful_count` are spike affordances, not a real
  # public-API design: the demo dataset's `Product#top_reviews` sorts by
  # helpful_count DESC, verified DESC, created_at DESC, and product 1 carries
  # 50k seeded reviews topping out at helpful_count 120 — a fresh review with
  # the default 0 would never enter the visible top-5, masking whether the
  # refetch mechanism works. The canned payload pins itself into the list so
  # the experiment observes the refresh, not the ranking.
  def review_params
    params.require(:review).permit(:rating, :title, :comment, :reviewer_name,
                                   :verified_purchase, :helpful_count)
  end
end

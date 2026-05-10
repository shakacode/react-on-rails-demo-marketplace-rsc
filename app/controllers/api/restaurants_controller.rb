class Api::RestaurantsController < ApplicationController
  skip_forgery_protection
  # Full detail payload consumed by the V2 client variant
  # (RestaurantDetailClient.tsx). Same data as the SSR/RSC variants — the
  # only difference is the variant uses a client-side fetch instead of
  # rendering on first request.
  def detail
    restaurant = Restaurant.find(params[:id])
    render json: RestaurantDetailData.for(restaurant)
  end
end

# frozen_string_literal: true

class RestaurantsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:search_rsc]

  # V1: Full Server SSR — fetch ALL data, return complete page
  def search_ssr
    restaurants = fetch_restaurants

    # Sequential queries per restaurant — realistic Rails behavior
    @restaurant_data = restaurants.map do |r|
      {
        id: r.id,
        name: r.name,
        cuisine_type: r.cuisine_type,
        city: r.city,
        state: r.state,
        image_url: r.image_url,
        latitude: r.latitude,
        longitude: r.longitude,
        average_rating: r.average_rating,
        review_count: r.review_count,
        status: r.current_status,
        wait_time: r.current_wait_time,
        specials: r.active_promotions.map { |p| serialize_promotion(p) },
        trending: r.trending_items.map { |item| serialize_menu_item(item) },
      }
    end
  end

  # V2: Client Components — send basic info only, client fetches the rest
  def search_client
    @restaurants = fetch_restaurants
  end

  # V3: RSC Streaming — send basic info, server components fetch async data
  def search_rsc
    @restaurants = fetch_restaurants
    stream_view_containing_react_components(template: "restaurants/search_rsc")
  end

  private

  def fetch_restaurants
    scope = Restaurant.all
    scope = scope.by_cuisine(params[:cuisine]) if params[:cuisine].present?
    scope = scope.in_city(params[:city]) if params[:city].present?
    if params[:q].present?
      query = "%#{params[:q].to_s.strip}%"
      scope = scope.where(
        "name ILIKE :q OR cuisine_type ILIKE :q OR city ILIKE :q",
        q: query,
      )
    end
    scope.limit(12)
  end

  def serialize_promotion(promo)
    {
      id: promo.id,
      title: promo.title,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      code: promo.code,
      ends_at: promo.ends_at.iso8601,
    }
  end

  def serialize_menu_item(item)
    {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price.to_f,
      description: item.description,
    }
  end
end

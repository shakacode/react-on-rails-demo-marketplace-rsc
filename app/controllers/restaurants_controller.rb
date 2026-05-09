# frozen_string_literal: true

class RestaurantsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[show_rsc]

  # V1: Full SSR — assemble the entire detail payload (markdown bio,
  # 80-item menu, 40 reviews, multi-currency price ladder data) and pass
  # it to the SSRed React component. Same payload as the RSC variant —
  # the difference is that here the markdown rendering happens on the
  # client during hydration too, because RestaurantDetailSSR has 'use client'.
  def show_ssr
    @restaurant = Restaurant.find(params[:id])
    @detail = RestaurantDetailData.for(@restaurant)
  end

  # V2: Client variant — server sends minimal restaurant info; the React
  # component fetches /api/restaurants/:id/detail after hydration.
  def show_client
    @restaurant = Restaurant.find(params[:id])
  end

  # V3: RSC streaming — same payload as SSR, but rendered as a server
  # component. marked / highlight.js / sanitize-html / intl-messageformat all
  # run server-side; the client receives only HTML.
  def show_rsc
    @restaurant = Restaurant.find(params[:id])
    @detail = RestaurantDetailData.for(@restaurant)
    stream_view_containing_react_components(template: "restaurants/show_rsc")
  end
end

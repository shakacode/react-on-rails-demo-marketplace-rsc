# frozen_string_literal: true

class RestaurantsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[show_rsc]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "show_ssr" => "Server-Side Rendering (SSR)",
    "show_client" => "Client-Side Rendering",
    "show_rsc" => "React Server Components (RSC)"
  }.freeze

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

  private

  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    @page_title = "Restaurant Detail — #{variant} | React on Rails RSC Demo" if variant
    @page_description =
      "A content-heavy restaurant detail page (markdown bio, 80-item menu, 40 reviews) " \
      "comparing React Server Components against SSR and client-side rendering."
  end
end

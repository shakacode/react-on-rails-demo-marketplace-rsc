# frozen_string_literal: true

class DashboardAnalyticsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:show_rsc]

  ALLOWED_RANGES = { "7d" => 7, "30d" => 30, "90d" => 90 }.freeze
  DEFAULT_RANGE = "7d"

  # V1: Full Server SSR — fetch ALL data, return complete page
  # All queries must complete before ANY HTML is sent to the browser.
  def show_ssr
    @restaurant_data = dashboard_header_data
    @range = current_range
    days = ALLOWED_RANGES[@range]

    # Sequential queries — every one blocks the response
    @kpi_stats = Restaurant.dashboard_kpi_stats(days: days)
    @revenue_data = Restaurant.dashboard_revenue_by_day(days: [days * 2, 14].max)
    @order_status = Restaurant.dashboard_order_status(days: days)
    @recent_orders = Restaurant.dashboard_recent_orders(days: days)
    @top_items = Restaurant.dashboard_top_menu_items
    @hourly_data = Restaurant.dashboard_hourly_distribution(days: days)
  end

  # V2: Client Components — send basic restaurant data, client fetches the rest
  def show_client
    @restaurant_data = dashboard_header_data
    @range = current_range
  end

  # V3: RSC Streaming — shell streams immediately, data streams as queries resolve
  def show_rsc
    @restaurant_data = dashboard_header_data
    @range = current_range
    stream_view_containing_react_components(template: "dashboard_analytics/show_rsc")
  end

  private

  def current_range
    candidate = params[:range].to_s
    ALLOWED_RANGES.key?(candidate) ? candidate : DEFAULT_RANGE
  end

  def dashboard_header_data
    {
      id: 0,
      name: "All Restaurants",
      cuisine_type: "Multi-Cuisine",
      city: "Network",
      state: "US",
      average_rating: 4.2,
      review_count: Restaurant.sum(:review_count)
    }
  end
end

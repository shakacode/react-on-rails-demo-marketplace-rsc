# frozen_string_literal: true

class RestaurantsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[show_rsc show_rsc_cached show_rsc_virtual]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "show_ssr" => "Server-Side Rendering (SSR)",
    "show_client" => "Client-Side Rendering",
    "show_rsc" => "React Server Components (RSC)",
    "show_ssr_virtual" => "SSR + Virtualized Reviews",
    "show_rsc_virtual" => "RSC + Virtualized Reviews"
  }.freeze

  # Virtualized review-list experiment knobs (issue #184). ?count= raises the
  # synthesized review count for measurement (default 40 keeps the benchmark
  # story untouched); ?initial= sets how many rows of two cards the server
  # renders into the HTML (react-virtuoso's initialItemCount; 0 = none).
  # Measurement-only: both knobs are honored only when the server was started
  # with ENABLE_BENCH_PARAMS=1 (the documented local benchmark flow) and are
  # no-ops on the public deployment.
  BENCH_PARAMS_ENV = "ENABLE_BENCH_PARAMS"
  MAX_REVIEWS_COUNT = 500
  DEFAULT_INITIAL_ROWS = 3
  MAX_INITIAL_ROWS = 20

  # V1: Full SSR — assemble the entire detail payload (markdown bio,
  # 80-item menu, 40 reviews, multi-currency price ladder data) and pass
  # it to the SSRed React component. Same payload as the RSC variant —
  # the difference is that here the markdown rendering happens on the
  # client during hydration too, because RestaurantDetailSSR has 'use client'.
  def show_ssr
    @restaurant = Restaurant.find(params[:id])
    @detail = RestaurantDetailData.for(@restaurant, reviews_count: reviews_count_param)
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
    @detail = RestaurantDetailData.for(@restaurant, reviews_count: reviews_count_param)
    stream_view_containing_react_components(template: "restaurants/show_rsc")
  end

  # SSR + virtualized reviews (issue #184, Shape A) — same page as show_ssr,
  # but the review list mounts through the react-virtuoso client wrapper.
  def show_ssr_virtual
    @restaurant = Restaurant.find(params[:id])
    @detail = virtual_detail_props
  end

  # RSC + virtualized reviews (issue #184, Shape B) — same page as show_rsc,
  # but the server-rendered review-card elements are mounted through the
  # react-virtuoso client wrapper.
  def show_rsc_virtual
    @restaurant = Restaurant.find(params[:id])
    @detail = virtual_detail_props
    stream_view_containing_react_components(template: "restaurants/show_rsc_virtual")
  end

  # V1 cached: cached_react_component. On a cache hit, both the detail assembly (built lazily in the
  # view block) and the SSR prerender are skipped.
  def show_ssr_cached
    @restaurant = Restaurant.find(params[:id])
  end

  # V3 cached: cached_stream_react_component. On a hit, the streamed chunks are replayed and the
  # detail assembly (view block) + node render are skipped.
  def show_rsc_cached
    @restaurant = Restaurant.find(params[:id])
    stream_view_containing_react_components(template: "restaurants/show_rsc_cached")
  end

  private

  def virtual_detail_props
    detail = RestaurantDetailData.for(@restaurant, reviews_count: reviews_count_param)
    detail.merge(virtualization: { initial_rows: initial_rows_param })
  end

  def bench_params_enabled?
    ENV[BENCH_PARAMS_ENV] == "1"
  end

  def reviews_count_param
    return RestaurantDetailData::DEFAULT_REVIEWS_COUNT unless bench_params_enabled?

    count = Integer(params[:count], 10, exception: false)
    return RestaurantDetailData::DEFAULT_REVIEWS_COUNT unless count&.positive?

    [count, MAX_REVIEWS_COUNT].min
  end

  def initial_rows_param
    return DEFAULT_INITIAL_ROWS unless bench_params_enabled?

    initial = Integer(params[:initial], 10, exception: false)
    return DEFAULT_INITIAL_ROWS if initial.nil?

    initial.clamp(0, MAX_INITIAL_ROWS)
  end

  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    @page_title = "Restaurant Detail — #{variant} | React on Rails RSC Demo" if variant
    @page_description =
      "A content-heavy restaurant detail page (markdown bio, 80-item menu, 40 reviews) " \
      "comparing React Server Components against SSR and client-side rendering."
  end
end

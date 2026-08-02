# frozen_string_literal: true

class ProductsController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering
  include ProductSerialization

  enable_async_react_rendering only: %i[show_rsc show_rsc_cached show_rsc_pull show_ppr]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "show_ssr" => "Server-Side Rendering (SSR)",
    "show_client" => "Client-Side Rendering",
    "show_rsc" => "React Server Components (RSC)",
    "show_rsc_pull" => "RSC Pull-Mode (Bidirectional Async Props)",
    "show_ppr" => "Partial Prerendering (PPR)"
  }.freeze

  # V1: Full Server SSR — fetch ALL data, return complete page
  # All data must be ready before ANY HTML is sent to the browser.
  def show_ssr
    product = find_product

    # Sequential queries — each one blocks the response
    reviews = product.top_reviews(10)
    review_stats = product.review_stats
    related = product.related_products(4)

    @product_data = serialize_product(product)
    @reviews_data = reviews.map { |r| serialize_review(r) }
    @review_stats_data = review_stats
    @related_products_data = related.map { |p| serialize_product_card(p) }
  end

  # V2: Client Components — send basic product data, client fetches the rest
  def show_client
    @product_data = serialize_product(find_product)
  end

  # V3: RSC Streaming — shell streams immediately, heavy data streams as it resolves
  def show_rsc
    @product = find_product
    # Exclude description/features/specs from initial props — they stream via product_details
    # async prop to keep the initial shell small and prioritize LCP.
    @product_data = serialize_product(@product).except(:description, :features, :specs)
    stream_view_containing_react_components(template: "products/show_rsc")
  end

  # V1 cached: cached_react_component. Only the cheap base serialize runs eagerly (also powers the
  # hero preload); the expensive reviews/related/stats are built lazily in the view block
  # (product_ssr_props) and skipped, along with the prerender, on a cache hit.
  def show_ssr_cached
    @product = find_product
    @product_data = serialize_product(@product)
  end

  # V3 cached: cached_stream_react_component_with_async_props. On a hit, the async block
  # (reviews/related/etc.) and the node render are skipped; chunks are replayed from cache.
  def show_rsc_cached
    @product = find_product
    @product_data = serialize_product(@product).except(:description, :features, :specs)
    stream_view_containing_react_components(template: "products/show_rsc_cached")
  end

  # V5: RSC Pull-Mode — bidirectional async props with unstable_cache.
  # Uses push_props: [] so Rails waits for React to request each prop via propRequest
  # instead of eagerly pushing everything. Combined with unstable_cache on the JS side,
  # cached components never request their prop → Rails never queries the DB for it.
  def show_rsc_pull
    @product = find_product
    @product_data = serialize_product(@product).except(:description, :features, :specs)
    stream_view_containing_react_components(template: "products/show_rsc_pull")
  end

  # V4: PPR — static shell cached, dynamic content streams fresh.
  # The prerender phase runs the full component tree but aborts before suspended
  # boundaries resolve, caching the shell (hero + skeletons). On subsequent
  # requests the cached shell serves instantly while only the dynamic Suspense
  # boundaries (reviews, related, etc.) stream fresh from the server.
  def show_ppr
    @product = find_product
    @product_data = serialize_product(@product)
    stream_view_containing_react_components(template: "products/show_ppr")
  end

  private

  # Full SSR props, built lazily for the cached view block (evaluated only on a cache miss).
  def product_ssr_props
    {
      product: @product_data,
      reviews: @product.top_reviews(10).map { |r| serialize_review(r) },
      review_stats: @product.review_stats,
      related_products: @product.related_products(4).map { |p| serialize_product_card(p) }
    }
  end
  helper_method :product_ssr_props

  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    @page_title = "Product Page — #{variant} | React on Rails RSC Demo" if variant
    @page_description =
      "An e-commerce product page rendered three ways — comparing React Server " \
      "Components against SSR and client-side rendering in the React on Rails demo."
  end

  def hero_image_url
    @product_data&.dig(:images, 0, "url") || @product_data&.dig(:images, 0, :url)
  end
  helper_method :hero_image_url

  def find_product
    if params[:id]
      Product.find(params[:id])
    else
      Product.first!
    end
  end
end

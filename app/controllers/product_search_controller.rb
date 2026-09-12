# frozen_string_literal: true

class ProductSearchController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering
  include ProductSerialization

  enable_async_react_rendering only: %i[search_rsc search_rsc_cached]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "search_ssr" => "Server-Side Rendering (SSR)",
    "search_client" => "Client-Side Rendering",
    "search_rsc" => "React Server Components (RSC)"
  }.freeze

  PER_PAGE = 24

  # V1: Full SSR — fetch ALL data (products + facets + stats + reviews + tags), return complete page.
  # Every query blocks the response — nothing renders until everything is ready.
  # All component code + libraries (marked, highlight.js ~400KB) shipped to client for hydration.
  def search_ssr
    products_scope = Product.filtered_search(search_params)
    @products_data = paginate_and_serialize(products_scope, PER_PAGE)
    @facets_data = Product.facets(base_scope_for_facets)
    @search_meta = search_meta_data(products_scope)
    @review_snippets = load_review_snippets(@products_data[:products].map { |p| p[:id] }, per_product: 2)
    @popular_tags = load_popular_tags
    @brand_highlights = load_brand_highlights
    @empty_state_suggestions = empty_state_suggestions if @products_data[:products].empty?
  end

  # V2: Client Components — send minimal data, client fetches rest via API
  def search_client
    @search_params = search_params.to_h
  end

  # V3: RSC Streaming — shell streams immediately with search bar and filter skeleton,
  # then results and facets stream as they resolve.
  def search_rsc
    @search_params_data = search_params.to_h
    stream_view_containing_react_components(template: "product_search/search_rsc")
  end

  # V1 cached: cached_react_component. On a hit, the full SSR data assembly (built lazily in the view
  # block via product_search_ssr_props) and the prerender are skipped. Cache key is the search params.
  def search_ssr_cached
    @search_params_data = search_params.to_h
  end

  # V3 cached: cached_stream_react_component_with_async_props. On a hit, the async block (results,
  # facets, tags, brand highlights) and the node render are skipped; chunks replay from cache.
  def search_rsc_cached
    @search_params_data = search_params.to_h
    stream_view_containing_react_components(template: "product_search/search_rsc_cached")
  end

  private

  # Full SSR props, built lazily for the cached view block (evaluated only on a cache miss).
  def product_search_ssr_props
    products_scope = Product.filtered_search(search_params)
    products_data = paginate_and_serialize(products_scope, PER_PAGE)
    {
      products: products_data[:products],
      pagination: products_data[:pagination],
      facets: Product.facets(base_scope_for_facets),
      search_meta: search_meta_data(products_scope),
      review_snippets: load_review_snippets(products_data[:products].map { |p| p[:id] }, per_product: 2),
      popular_tags: load_popular_tags,
      brand_highlights: load_brand_highlights
    }
  end
  helper_method :product_search_ssr_props

  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    @page_title = "Product Search — #{variant} | React on Rails RSC Demo" if variant
    @page_description =
      "A faceted product-search page with filters and independently loaded sections — " \
      "comparing React Server Components against SSR and client-side rendering."
  end

  def search_params
    params.permit(:q, :category, :brand, :min_rating, :in_stock, :price_min, :price_max, :sort, :page)
  end

  def base_scope_for_facets
    scope = Product.all
    scope = scope.search_query(search_params[:q]) if search_params[:q].present?
    scope
  end

  def paginate_and_serialize(scope, per_page = PER_PAGE)
    page = (search_params[:page] || 1).to_i
    total = scope.count
    products = scope.offset((page - 1) * per_page).limit(per_page)

    {
      products: products.map { |p| serialize_search_product(p, variant: :search_rich) },
      pagination: {
        current_page: page,
        total_pages: (total / per_page.to_f).ceil,
        total_count: total,
        per_page: per_page
      }
    }
  end

  def search_meta_data(scope)
    {
      query: search_params[:q] || '',
      sort: search_params[:sort] || 'relevance',
      total_results: scope.count,
      filters_applied: active_filters
    }
  end

  def active_filters
    filters = []
    filters << { type: 'category', value: search_params[:category] } if search_params[:category].present?
    filters << { type: 'brand', value: search_params[:brand] } if search_params[:brand].present?
    filters << { type: 'min_rating', value: "#{search_params[:min_rating]}+" } if search_params[:min_rating].present?
    filters << { type: 'in_stock', value: 'In Stock Only' } if search_params[:in_stock] == 'true'
    if search_params[:price_min].present? && search_params[:price_max].present?
      filters << { type: 'price', value: "$#{search_params[:price_min]} - $#{search_params[:price_max]}" }
    end
    filters
  end

  def load_popular_tags
    # Aggregate popular tags across all products for the sidebar tag cloud
    Product.where.not(tags: nil)
      .pluck(:tags)
      .flatten
      .tally
      .sort_by { |_, count| -count }
      .first(20)
      .map { |tag, count| { name: tag, count: count } }
  end

  def load_brand_highlights
    # Load top brands with product counts and average ratings
    Product.group(:brand)
      .select("brand, COUNT(*) as product_count, AVG(average_rating) as avg_rating")
      .order("product_count DESC")
      .limit(8)
      .map do |b|
        {
          name: b.brand,
          product_count: b.product_count,
          avg_rating: b.avg_rating.to_f.round(1)
        }
      end
  end

  # Server-computed suggestions surfaced when the current search returns 0 results.
  # Computed against the WHOLE catalog (not the empty filtered scope) so the
  # user always has somewhere to land.
  def empty_state_suggestions
    {
      top_categories: Product.group(:category)
                            .order(Arel.sql("COUNT(*) DESC"))
                            .limit(6)
                            .pluck(Arel.sql("category, COUNT(*)"))
                            .map { |name, count| { name: name, count: count } },
      top_brands: Product.group(:brand)
                        .order(Arel.sql("COUNT(*) DESC"))
                        .limit(8)
                        .pluck(Arel.sql("brand, COUNT(*)"))
                        .map { |name, count| { name: name, count: count } },
    }
  end
end

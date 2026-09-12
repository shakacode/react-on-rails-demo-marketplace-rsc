# frozen_string_literal: true

module Api
  class ProductSearchController < ApplicationController
    include ProductSerialization

    skip_forgery_protection

    PER_PAGE = 24

    def results
      products_scope = Product.filtered_search(search_params)
      page = (search_params[:page] || 1).to_i
      total = products_scope.count
      products = products_scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE)

      render json: {
        products: products.map { |p| serialize_search_product(p, variant: :search_card) },
        pagination: {
          current_page: page,
          total_pages: (total / PER_PAGE.to_f).ceil,
          total_count: total,
          per_page: PER_PAGE
        },
        meta: {
          query: search_params[:q] || '',
          sort: search_params[:sort] || 'relevance',
          total_results: total
        },
        timestamp: Time.current.iso8601
      }
    end

    def facets
      scope = Product.all
      scope = scope.search_query(search_params[:q]) if search_params[:q].present?

      render json: {
        facets: Product.facets(scope),
        timestamp: Time.current.iso8601
      }
    end

    # Review snippets for client-side search — now uses the same concern method
    # as SSR/RSC (2 per product, rating >= 3, 200-char comment truncation).
    def review_snippets
      product_ids = params[:product_ids]&.map(&:to_i) || []
      return render(json: { snippets: {} }) if product_ids.empty?

      snippets = load_review_snippets(product_ids, per_product: 2)

      render json: { snippets: snippets, timestamp: Time.current.iso8601 }
    end

    private

    def search_params
      params.permit(:q, :category, :brand, :min_rating, :in_stock, :price_min, :price_max, :sort, :page)
    end
  end
end

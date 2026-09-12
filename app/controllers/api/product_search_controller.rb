# frozen_string_literal: true

module Api
  class ProductSearchController < ApplicationController
    skip_forgery_protection

    PER_PAGE = SearchPagination::DEFAULT_PER_PAGE

    # Both endpoints are unauthenticated, so a single request may carry any
    # number of ids; everything past this cap is ignored (issue #239).
    MAX_REVIEW_SNIPPET_PRODUCT_IDS = 100

    # An id is an Integer or a string of only digits — never coerced, since
    # "7abc".to_i is 7 and a lenient parse would resolve malformed input to a
    # REAL product's data (issue #239). 18 digits keeps every id inside
    # PostgreSQL's bigint; the Integer branch (a JSON body produces real
    # Integers) shares the same ceiling so the two branches stay congruent
    # rather than leaning on Rails' tolerance of out-of-range IN-list binds.
    MAX_PRODUCT_ID_DIGITS = 18
    MAX_PRODUCT_ID = (10**MAX_PRODUCT_ID_DIGITS) - 1
    PRODUCT_ID_FORMAT = /\A\d{1,#{MAX_PRODUCT_ID_DIGITS}}\z/

    def results
      products_scope = Product.filtered_search(search_params)
      products, pagination = SearchPagination.paginate(
        products_scope, page: search_params[:page], per_page: PER_PAGE
      )

      render json: {
        products: products.map { |p| serialize_product(p) },
        pagination: pagination,
        meta: {
          query: search_params[:q] || '',
          sort: search_params[:sort] || 'relevance',
          total_results: pagination[:total_count]
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

    def review_snippets
      product_ids = sanitized_product_ids
      return render(json: { snippets: {} }) if product_ids.empty?

      snippets = ProductReview
        .where(product_id: product_ids)
        .where('rating >= 4')
        .where(verified_purchase: true)
        .select('DISTINCT ON (product_id) product_id, title, rating, reviewer_name, comment, helpful_count')
        .order(:product_id, helpful_count: :desc)
        .each_with_object({}) do |review, hash|
          hash[review.product_id] = {
            title: review.title,
            rating: review.rating,
            reviewer_name: review.reviewer_name,
            comment: review.comment&.truncate(150),
            helpful_count: review.helpful_count
          }
        end

      render json: { snippets: snippets, timestamp: Time.current.iso8601 }
    end

    private

    # Issue #239: `product_ids` used to be trusted as an array of ids — a scalar
    # value 500'd with NoMethodError. Coerce whatever arrives to an array, cap
    # it BEFORE any per-entry work (so a huge posted array is bounded up front),
    # and keep only entries that are literally ids (see MAX_PRODUCT_ID_DIGITS).
    def sanitized_product_ids
      Array(params[:product_ids])
        .first(MAX_REVIEW_SNIPPET_PRODUCT_IDS)
        .filter_map { |raw| product_id_from(raw) }
    end

    def product_id_from(raw)
      case raw
      when Integer
        raw if raw.positive? && raw <= MAX_PRODUCT_ID
      when String
        # valid_encoding? guards the regex: invalid UTF-8 bytes in a param
        # would make match? raise ArgumentError.
        raw.to_i if raw.valid_encoding? && raw.match?(PRODUCT_ID_FORMAT)
      end
    end

    def search_params
      params.permit(:q, :category, :brand, :min_rating, :in_stock, :price_min, :price_max, :sort, :page)
    end

    def serialize_product(product)
      {
        id: product.id,
        name: product.name,
        description: product.description&.truncate(200),
        price: product.price.to_f,
        original_price: product.original_price&.to_f,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
        images: product.images,
        features: (product.features || []).first(3),
        tags: product.tags || [],
        average_rating: product.average_rating.to_f,
        review_count: product.review_count,
        in_stock: product.in_stock,
        stock_quantity: product.stock_quantity,
        discount_percentage: product.discount_percentage
      }
    end
  end
end

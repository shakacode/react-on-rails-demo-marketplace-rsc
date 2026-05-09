# frozen_string_literal: true

class ProductSearchController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:search_rsc]

  PER_PAGE = 24

  # V1: Full SSR — fetch ALL data (products + facets + stats + reviews + tags), return complete page.
  # Every query blocks the response — nothing renders until everything is ready.
  # All component code + libraries (marked, highlight.js ~400KB) shipped to client for hydration.
  def search_ssr
    products_scope = Product.filtered_search(search_params)
    @products_data = paginate_and_serialize(products_scope, PER_PAGE, rich: true)
    @facets_data = Product.facets(base_scope_for_facets)
    @search_meta = search_meta_data(products_scope)
    @product_descriptions = load_product_descriptions(@products_data[:products], truncate_at: 500)
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

  private

  def search_params
    params.permit(:q, :category, :brand, :min_rating, :in_stock, :price_min, :price_max, :sort, :page)
  end

  def base_scope_for_facets
    scope = Product.all
    scope = scope.search_query(search_params[:q]) if search_params[:q].present?
    scope
  end

  def paginate_and_serialize(scope, per_page = PER_PAGE, rich: false)
    page = (search_params[:page] || 1).to_i
    total = scope.count
    products = scope.offset((page - 1) * per_page).limit(per_page)

    {
      products: products.map { |p| serialize_search_result(p, rich: rich) },
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

  def serialize_search_result(product, rich: false)
    result = {
      id: product.id,
      name: product.name,
      description: product.description&.truncate(rich ? 500 : 200),
      price: product.price.to_f,
      original_price: product.original_price&.to_f,
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      images: product.images,
      features: rich ? (product.features || []).first(6) : (product.features || []).first(3),
      tags: product.tags || [],
      average_rating: product.average_rating.to_f,
      review_count: product.review_count,
      in_stock: product.in_stock,
      stock_quantity: product.stock_quantity,
      discount_percentage: product.discount_percentage
    }

    if rich
      # Include additional data that increases hydration payload
      result[:specs] = product.specs || {}
    end

    result
  end

  def load_product_descriptions(products, truncate_at: 200)
    products.each_with_object({}) do |p, hash|
      hash[p[:id]] = p[:description]&.truncate(truncate_at) || p[:description]
    end
  end

  def load_review_snippets(product_ids, per_product: 1)
    return {} if product_ids.empty?

    if per_product == 1
      ProductReview
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
    else
      # Load multiple reviews per product using window function (avoids loading all reviews into memory)
      sql = <<~SQL
        SELECT product_id, title, rating, reviewer_name, comment, helpful_count
        FROM (
          SELECT product_id, title, rating, reviewer_name, comment, helpful_count,
                 ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY helpful_count DESC, created_at DESC) as rn
          FROM product_reviews
          WHERE product_id IN (#{product_ids.map { |id| ActiveRecord::Base.connection.quote(id) }.join(',')})
            AND rating >= 3
            AND verified_purchase = true
        ) ranked
        WHERE rn <= #{per_product}
      SQL

      reviews = ActiveRecord::Base.connection.execute(sql)
      reviews.each_with_object({}) do |row, hash|
        pid = row['product_id']
        hash[pid] ||= []
        hash[pid] << {
          title: row['title'],
          rating: row['rating'],
          reviewer_name: row['reviewer_name'],
          comment: row['comment']&.truncate(200),
          helpful_count: row['helpful_count']
        }
      end
    end
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

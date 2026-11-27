# frozen_string_literal: true

class Product < ApplicationRecord
  has_many :product_reviews, dependent: :destroy

  validates :name, presence: true
  validates :price, presence: true, numericality: { greater_than: 0 }
  validates :category, presence: true
  validates :brand, presence: true
  validates :sku, presence: true, uniqueness: true

  scope :in_category, ->(category) { where(category: category) }
  scope :by_brand, ->(brand) { where(brand: brand) }
  scope :price_range, ->(min, max) { where(price: min..max) }
  scope :min_rating, ->(rating) { where('average_rating >= ?', rating) }
  scope :in_stock_only, -> { where(in_stock: true) }
  scope :with_tag, ->(tag) { where('tags @> ?', [tag].to_json) }
  scope :search_query, ->(q) {
    where('name ILIKE :q OR brand ILIKE :q OR category ILIKE :q OR description ILIKE :q', q: "%#{q}%")
  }

  def self.facets(scope = all)
    stock = arel_table[:in_stock]
    in_stock, out_of_stock, total = facet_counts(scope, [stock.eq(true), stock.eq(false), nil])

    {
      categories: scope.group(:category).count.sort_by { |_, v| -v },
      brands: scope.group(:brand).count.sort_by { |_, v| -v },
      price_ranges: compute_price_ranges(scope),
      rating_distribution: compute_rating_distribution(scope),
      in_stock_count: in_stock,
      out_of_stock_count: out_of_stock,
      total_count: total
    }
  end

  def self.compute_price_ranges(scope)
    ranges = [
      { label: 'Under $50', min: 0, max: 50 },
      { label: '$50 - $100', min: 50, max: 100 },
      { label: '$100 - $250', min: 100, max: 250 },
      { label: '$250 - $500', min: 250, max: 500 },
      { label: '$500 - $1,000', min: 500, max: 1000 },
      { label: 'Over $1,000', min: 1000, max: 100_000 }
    ]
    buckets = ranges.map { |range| arel_table[:price].between(range[:min]...range[:max]) }
    ranges.zip(facet_counts(scope, buckets)).map { |range, count| range.merge(count: count) }
  end

  def self.compute_rating_distribution(scope)
    stars = 5.downto(1)
    buckets = stars.map { |star| Arel.sql('average_rating').between(star...(star + 1)) }
    stars.zip(facet_counts(scope, buckets)).map { |star, count| { stars: star, count: count } }
  end

  def self.facet_counts(scope, buckets)
    # Batch the search paths (all or where). Other relation clauses retain Active Record's
    # per-bucket count semantics, e.g. a limit applies to the matching rows of each bucket.
    return buckets.map { |bucket| scope.where(bucket).count } if scope.values.except(:where).any?

    # Compute all requested counts in one scan. A nil bucket counts every row.
    aggregates = buckets.map { |bucket| bucket ? Arel.star.count.filter(bucket) : Arel.star.count }
    scope.pick(*aggregates) || Array.new(buckets.size, 0)
  end
  private_class_method :facet_counts

  def self.filtered_search(params)
    scope = all
    scope = scope.search_query(params[:q]) if params[:q].present?
    scope = scope.in_category(params[:category]) if params[:category].present?
    scope = scope.by_brand(params[:brand]) if params[:brand].present?
    scope = scope.min_rating(params[:min_rating].to_f) if params[:min_rating].present?
    scope = scope.in_stock_only if params[:in_stock] == 'true'
    if params[:price_min].present? && params[:price_max].present?
      scope = scope.price_range(params[:price_min].to_f, params[:price_max].to_f)
    end

    sort = params[:sort] || 'relevance'
    scope = case sort
            when 'price_asc' then scope.order(price: :asc)
            when 'price_desc' then scope.order(price: :desc)
            when 'rating' then scope.order(average_rating: :desc, review_count: :desc)
            when 'reviews' then scope.order(review_count: :desc)
            when 'newest' then scope.order(created_at: :desc)
            else scope.order(review_count: :desc, average_rating: :desc)
            end

    scope
  end

  def discount_percentage
    return nil unless original_price && original_price > price

    ((1 - (price / original_price)) * 100).round
  end

  def review_stats
    stats = product_reviews
      .group(:rating)
      .count

    total = stats.values.sum
    distribution = (1..5).map do |star|
      count = stats[star] || 0
      {
        stars: star,
        count: count,
        percentage: total > 0 ? (count * 100.0 / total).round(1) : 0
      }
    end.reverse

    {
      average_rating: average_rating.to_f,
      total_reviews: review_count,
      distribution: distribution
    }
  end

  def top_reviews(limit = 10)
    product_reviews
      .order(helpful_count: :desc, verified_purchase: :desc, created_at: :desc)
      .limit(limit)
  end

  def related_products(limit = 4)
    Product
      .where(category: category)
      .where.not(id: id)
      .order(average_rating: :desc, review_count: :desc)
      .limit(limit)
  end

  def update_cached_rating!
    stats = product_reviews.select('AVG(rating) as avg, COUNT(*) as cnt').take
    update!(
      average_rating: stats.avg&.round(2) || 0,
      review_count: stats.cnt || 0
    )
  end
end

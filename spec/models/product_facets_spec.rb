# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Product, '.facets' do
  include TestData

  let(:scope) do
    ids = [
      create_product(price: 25, average_rating: 3, in_stock: true),
      create_product(price: 27, average_rating: 3, in_stock: true),
      create_product(price: 60, average_rating: 4, in_stock: false)
    ].map(&:id)
    Product.where(id: ids)
  end

  def facet_totals(relation)
    facets = Product.facets(relation)
    [
      facets.fetch(:price_ranges).pluck(:count),
      facets.fetch(:rating_distribution).pluck(:count),
      facets.values_at(:in_stock_count, :out_of_stock_count, :total_count)
    ]
  end

  it 'applies a limit to the matching rows within each bucket' do
    expect(facet_totals(scope.limit(0))).to eq([[0] * 6, [0] * 5, [0, 0, 0]])
    expect(facet_totals(scope.limit(1))).to eq([[1, 1, 0, 0, 0, 0], [0, 1, 1, 0, 0], [1, 1, 1]])
  end

  it 'counts each product once on a distinct join' do
    product = create_product(price: 25)
    add_reviews(product, count: 2)
    relation = Product.where(id: product.id).joins(:product_reviews).distinct

    expect(facet_totals(relation)).to eq([[1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 0, 1]])
  end

  it 'applies an offset within each bucket before counting its remaining rows' do
    expect(facet_totals(scope.offset(1))).to eq([[1, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0], [1, 0, 2]])
  end
end

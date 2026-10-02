# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProductSerialization do
  let(:serializer) { Object.new.extend(described_class) }

  def snippets_for(ids, per_product: 2)
    serializer.send(:load_review_snippets, ids, per_product: per_product)
  end

  it 'keeps the top qualifying reviews per product, with newest reviews breaking ties' do
    first, second, empty = Array.new(3) { TestData.create_product }
    now = Time.current
    reviews = [
      { product: first, title: 'Older', helpful_count: 10, created_at: now - 1.day },
      { product: first, title: 'Newer', helpful_count: 10, created_at: now },
      { product: first, title: 'Lower', helpful_count: 1 },
      { product: first, title: 'Unverified', helpful_count: 100, verified_purchase: false },
      { product: first, title: 'Low rating', helpful_count: 100, rating: 2 },
      { product: second, title: 'Second product', helpful_count: 5 }
    ]
    reviews.each do |attributes|
      ProductReview.create!({ rating: 5, verified_purchase: true, reviewer_name: 'Reviewer',
                              comment: 'x' * 250 }.merge(attributes))
    end

    snippets = snippets_for([first.id, second.id, first.id, empty.id])

    expect(snippets.keys).to contain_exactly(first.id, second.id)
    expect(snippets[first.id].map { |review| review[:title] }).to eq(%w[Newer Older])
    expect(snippets[second.id].map { |review| review[:title] }).to eq(['Second product'])
    expect(snippets[first.id].first).to include(rating: 5, helpful_count: 10, reviewer_name: 'Reviewer',
                                                comment: "#{'x' * 197}...")
    expect(snippets_for([first.id], per_product: 1)[first.id].size).to eq(1)
    expect(snippets_for([first.id], per_product: 0)).to eq({})
    expect(snippets_for([first.id], per_product: -1)).to eq({})
    expect(snippets_for([])).to eq({})
  end

  [false, true].each do |mostly_unverified|
    it "bounds review-history reads when mostly_unverified=#{mostly_unverified}" do
      product = TestData.create_product
      now = Time.current
      review_count = mostly_unverified ? 10_000 : 1_000
      # rubocop:disable Rails/SkipsModelValidations -- bulk fixture models a long review history
      ProductReview.insert_all!(Array.new(review_count) do |index|
        { product_id: product.id, rating: 5, verified_purchase: !mostly_unverified || index < 2,
          reviewer_name: 'Reviewer',
          title: "Review #{index}", comment: 'Review body', helpful_count: index,
          created_at: now, updated_at: now }
      end)
      # rubocop:enable Rails/SkipsModelValidations
      connection = ActiveRecord::Base.connection
      connection.execute('ANALYZE product_reviews')

      sql = nil
      capture = ->(*args) { sql = args.last[:sql] if args.last[:sql].include?('FROM product_reviews') }
      snippets = ActiveSupport::Notifications.subscribed(capture, 'sql.active_record') do
        snippets_for([product.id])
      end
      expected_titles = mostly_unverified ? ['Review 1', 'Review 0'] : ['Review 999', 'Review 998']
      expect(snippets[product.id].map { |review| review[:title] }).to eq(expected_titles)

      # Count actual rows read, rather than imposing a machine-dependent time limit.
      plan = connection.execute("EXPLAIN (ANALYZE, FORMAT JSON) #{sql}").first.fetch('QUERY PLAN')
      plan = JSON.parse(plan) if plan.is_a?(String)
      nodes = [plan.first.fetch('Plan')]
      reviews_read = 0
      until nodes.empty?
        node = nodes.shift
        if node['Relation Name'] == 'product_reviews'
          reviews_read += (node.fetch('Actual Rows') + node.fetch('Rows Removed by Filter', 0)) *
                          node.fetch('Actual Loops')
        end
        nodes.concat(node.fetch('Plans', []))
      end
      expect(reviews_read).to be <= 10
    end
  end
end

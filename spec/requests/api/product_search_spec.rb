# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::ProductSearch', type: :request do
  describe 'GET /api/product_search/results' do
    before { create_list_of_products }

    it 'returns paginated products with metadata' do
      get '/api/product_search/results'

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['products']).to be_an(Array)
      expect(body['products']).not_to be_empty
      expect(body['pagination']).to include('current_page' => 1, 'per_page' => 24)
      expect(body['meta']).to include('total_results')
    end

    it 'filters by query string' do
      # Match on a token nothing else can contain rather than renaming every
      # other row, so the example holds whatever else is in the database (and
      # never issues a full-table write against a seeded one).
      token = "Findable#{SecureRandom.hex(6)}"
      target = create_product(category: 'Electronics', name: "#{token} Gizmo")
      other = create_product(category: 'Electronics', name: 'Generic Widget')

      get '/api/product_search/results', params: { q: token }

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body['products'].map { |p| p['id'] }
      expect(ids).to include(target.id)
      expect(ids).not_to include(other.id)
    end
  end

  describe 'GET /api/product_search/facets' do
    before { create_list_of_products }

    it 'returns facet aggregations' do
      get '/api/product_search/facets'

      expect(response).to have_http_status(:ok)
      facets = response.parsed_body['facets']
      expect(facets).to include('categories', 'brands', 'price_ranges', 'rating_distribution')
      expect(facets['total_count']).to be >= 1
    end
  end

  describe 'POST /api/product_search/review_snippets' do
    it 'returns one snippet per requested product that has a qualifying review' do
      product = create_product(category: 'Electronics')
      add_reviews(product)

      post '/api/product_search/review_snippets', params: { product_ids: [product.id] }

      expect(response).to have_http_status(:ok)
      snippets = response.parsed_body['snippets']
      expect(snippets[product.id.to_s]).to include('title', 'rating', 'reviewer_name')
    end

    it 'returns an empty snippet set when no ids are given' do
      post '/api/product_search/review_snippets', params: { product_ids: [] }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['snippets']).to eq({})
    end
  end

  # A small spread of products across categories/brands so search + facets have
  # something meaningful to aggregate.
  def create_list_of_products
    create_product(category: 'Electronics', brand: 'Acme', price: 49.0)
    create_product(category: 'Electronics', brand: 'Globex', price: 199.0)
    create_product(category: 'Home', brand: 'Initech', price: 750.0)
  end
end

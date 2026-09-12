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

    # Issue #239: a non-positive or non-numeric `page` used to reach PostgreSQL
    # as a negative OFFSET and 500. It clamps to page 1 instead (Kaminari-style).
    it 'clamps page=0 to the first page' do
      get '/api/product_search/results', params: { page: 0 }

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['pagination']).to include('current_page' => 1)
      expect(body['products']).not_to be_empty
    end

    it 'clamps a negative page to the first page' do
      get '/api/product_search/results', params: { page: -1 }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['pagination']).to include('current_page' => 1)
    end

    it 'clamps a non-numeric page to the first page' do
      get '/api/product_search/results', params: { page: 'abc' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['pagination']).to include('current_page' => 1)
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

    # Issue #239: a scalar `product_ids` used to raise NoMethodError (String#map)
    # and 500. Malformed input degrades to an empty snippet set instead.
    it 'returns an empty snippet set for a scalar product_ids value' do
      post '/api/product_search/review_snippets', params: { product_ids: 'abc' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['snippets']).to eq({})
    end

    it 'ignores ids beyond the product_ids cap' do
      within_cap = create_product
      beyond_cap = create_product
      add_reviews(within_cap)
      add_reviews(beyond_cap)

      cap = Api::ProductSearchController::MAX_REVIEW_SNIPPET_PRODUCT_IDS
      filler_ids = Array.new(cap - 1) { |i| 10_000_000 + i } # positive ids that match nothing
      ids = [within_cap.id, *filler_ids, beyond_cap.id] # beyond_cap sits past the cap

      post '/api/product_search/review_snippets', params: { product_ids: ids }

      expect(response).to have_http_status(:ok)
      snippets = response.parsed_body['snippets']
      expect(snippets).to have_key(within_cap.id.to_s)
      expect(snippets).not_to have_key(beyond_cap.id.to_s)
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

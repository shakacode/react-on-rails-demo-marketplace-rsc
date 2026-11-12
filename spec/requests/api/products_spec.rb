# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::Products', type: :request do
  let(:product) { create_product_with_reviews }

  describe 'GET /api/products/:id/reviews' do
    it 'returns the product reviews as JSON' do
      get "/api/products/#{product.id}/reviews"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['reviews']).to be_an(Array)
      expect(body['reviews'].size).to eq(3)
      expect(body['reviews'].first).to include('rating', 'reviewer_name', 'comment')
      expect(body).to have_key('timestamp')
    end
  end

  describe 'GET /api/products/:id/review_stats' do
    it 'returns the review distribution and totals' do
      get "/api/products/#{product.id}/review_stats"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['total_reviews']).to eq(3)
      expect(body['average_rating']).to eq(5.0)
      expect(body['distribution']).to be_an(Array)
    end
  end

  describe 'GET /api/products/:id/related_products' do
    it 'returns sibling products in the same category' do
      get "/api/products/#{product.id}/related_products"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['products']).to be_an(Array)
      expect(body['products']).not_to be_empty
      expect(body['products'].map { |p| p['id'] }).not_to include(product.id)
    end
  end

  describe 'unknown product id' do
    it 'responds 404 rather than 500' do
      get '/api/products/0/reviews'
      expect(response).to have_http_status(:not_found)
    end
  end
end

# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL endpoint", type: :request do
  let!(:product) { Product.first || create(:product) }

  describe "POST /graphql" do
    it "returns product data for a basic query" do
      query = <<~GQL
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
            price
            category
            brand
          }
        }
      GQL

      post "/graphql", params: { query: query, variables: { id: product.id } }, as: :json

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["data"]["product"]["name"]).to eq(product.name)
      expect(json["data"]["product"]["price"]).to be_a(Numeric)
      expect(json["errors"]).to be_nil
    end

    it "returns reviews and review_stats" do
      query = <<~GQL
        query GetProductReviews($id: ID!) {
          product(id: $id) {
            reviews(limit: 2) {
              id
              rating
              title
              reviewerName
            }
            reviewStats {
              averageRating
              totalReviews
              distribution {
                stars
                count
                percentage
              }
            }
          }
        }
      GQL

      post "/graphql", params: { query: query, variables: { id: product.id } }, as: :json

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["data"]["product"]["reviews"]).to be_an(Array)
      expect(json["data"]["product"]["reviewStats"]).to include("averageRating", "totalReviews")
    end

    it "rejects GET requests" do
      get "/graphql", params: { query: "{ product { id } }" }
      expect(response).to have_http_status(:not_found).or have_http_status(:method_not_allowed)
    end

    it "handles malformed queries gracefully" do
      post "/graphql", params: { query: "{ invalid @@@ syntax" }, as: :json

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["errors"]).to be_present
    end

    it "enforces max_depth" do
      # Build a deeply nested query that exceeds max_depth of 10
      deep_query = "{ product { relatedProducts { relatedProducts { relatedProducts " \
                   "{ relatedProducts { relatedProducts { relatedProducts { relatedProducts " \
                   "{ relatedProducts { relatedProducts { relatedProducts { id } } } } } } } } } } } }"

      post "/graphql", params: { query: deep_query }, as: :json

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["errors"]).to be_present
    end
  end
end

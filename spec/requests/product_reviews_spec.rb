# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'ProductReviews', type: :request do
  let(:product) { create_product_with_reviews }

  let(:valid_params) do
    {
      review: {
        rating: 5,
        title: 'Posted by the spike',
        comment: 'Canned review used to demonstrate RSC read-your-writes.',
        reviewer_name: 'Spike Bot',
        verified_purchase: true,
        helpful_count: 500
      }
    }
  end

  describe 'POST /products/:product_id/reviews' do
    it 'creates the review and responds 201 with the new id as JSON' do
      expect do
        post "/products/#{product.id}/reviews", params: valid_params, as: :json
      end.to change(product.product_reviews, :count).by(1)

      expect(response).to have_http_status(:created)
      review = ProductReview.find(response.parsed_body.fetch('id'))
      expect(review.reviewer_name).to eq('Spike Bot')
      expect(review.helpful_count).to eq(500)
      expect(review.verified_purchase).to be(true)
    end

    it 'makes the new review visible to the emit-block query the RSC page streams from' do
      post "/products/#{product.id}/reviews", params: valid_params, as: :json

      expect(response).to have_http_status(:created)
      # helpful_count 500 beats the TestData reviews (10..8), so read-your-writes
      # is observable through the same top_reviews(5) query both render doors use.
      expect(product.top_reviews(5).map(&:reviewer_name)).to include('Spike Bot')
    end

    it 'responds 422 with the FormResponders {errors: {field: [...]}} shape on invalid input' do
      post "/products/#{product.id}/reviews",
           params: { review: { rating: nil, title: 'No rating' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      body = response.parsed_body
      expect(body).to have_key('errors')
      expect(body['errors']).to include('rating', 'reviewer_name')
      expect(body['errors']['rating']).to be_an(Array)
      expect(body['errors']['rating']).not_to be_empty
    end

    it 'responds 404 for an unknown product id' do
      post '/products/0/reviews', params: valid_params, as: :json
      expect(response).to have_http_status(:not_found)
    end

    context 'with forgery protection enabled (as in development/production)' do
      around do |example|
        ActionController::Base.allow_forgery_protection = true
        example.run
      ensure
        ActionController::Base.allow_forgery_protection = false
      end

      it 'rejects a POST that carries no CSRF token' do
        url = "/products/#{product.id}/reviews" # materialize the product before measuring the count

        expect do
          post url, params: valid_params, as: :json
        end.not_to change(ProductReview, :count)

        # InvalidAuthenticityToken is rescuable → 422 under
        # config.action_dispatch.show_exceptions = :rescuable.
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end

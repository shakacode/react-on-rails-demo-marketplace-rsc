# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::Restaurants', type: :request do
  describe 'GET /api/restaurants/:id/detail' do
    it 'returns the full restaurant detail payload (consumed by the client variant)' do
      restaurant = create_restaurant

      get "/api/restaurants/#{restaurant.id}/detail"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['restaurant']).to include('id' => restaurant.id, 'name' => restaurant.name)
      # RestaurantDetailData assembles the heavy markdown/menu/reviews payload.
      expect(body).to include('bio', 'menu', 'reviews', 'hours', 'currencies')
      expect(body['menu']).to be_present
    end

    it 'responds 404 for an unknown restaurant' do
      get '/api/restaurants/0/detail'
      expect(response).to have_http_status(:not_found)
    end
  end
end

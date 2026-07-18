# frozen_string_literal: true

require 'rails_helper'

# rubocop:disable Metrics/BlockLength
RSpec.describe 'Public routes', type: :request do
  let!(:restaurant) do
    Restaurant.create!(
      name: 'Route Contract Restaurant',
      cuisine_type: 'Test Kitchen',
      timezone: 'UTC'
    )
  end

  let!(:product) do
    Product.create!(
      name: 'Route Contract Product',
      description: 'Deterministic product data for public route request specs.',
      price: 100,
      category: 'Test Category',
      brand: 'Test Brand',
      sku: 'route-contract-product'
    )
  end

  describe 'contract coverage' do
    it 'requires every GET route to be exercised or explicitly excluded' do
      route_patterns = PublicRouteContract.route_patterns
      exercised_patterns = PublicRouteContract.routes.map { |route_case| route_case.fetch('path') }

      expect(PublicRouteContract.uncovered_get_route_patterns(exercised_patterns)).to be_empty
      expect(exercised_patterns - route_patterns).to be_empty
    end

    it 'detects a deliberately unlisted public GET route' do
      exercised_patterns = PublicRouteContract.routes.map { |route_case| route_case.fetch('path') }

      expect(
        PublicRouteContract.uncovered_get_route_patterns(exercised_patterns - ['/why-rsc'])
      ).to include('/why-rsc')
    end
  end

  describe 'dynamic routes' do
    it 'renders a restaurant route with a deterministic existing id' do
      route_case = PublicRouteContract.routes.find { |candidate| candidate.fetch('path') == '/restaurant/:id/ssr' }
      request_path = route_case.fetch('path').sub(':id', restaurant.id.to_s)

      get request_path

      expect(response).to have_http_status(route_case.fetch('expected_status'))
    end
  end

  describe 'rendering contract' do
    PublicRouteContract.routes.each do |route_case|
      it "returns #{route_case.fetch('expected_status')} for #{route_case.fetch('path')}" do
        get request_path_for(route_case)

        expect(response).to have_http_status(route_case.fetch('expected_status'))

        next unless route_case.key?('expected_location')

        expected_location = route_case.fetch('expected_location')
        expected_location = "http://www.example.com#{expected_location}" if expected_location.start_with?('/')
        expect(response.location).to eq(expected_location)
      end
    end
  end

  def request_path_for(route_case)
    route_case.fetch('parameters', {}).reduce(
      route_case.fetch('request_path', route_case.fetch('path')).dup
    ) do |path, (parameter, fixture_name)|
      path.sub(":#{parameter}", public_send(fixture_name).id.to_s)
    end
  end
end
# rubocop:enable Metrics/BlockLength

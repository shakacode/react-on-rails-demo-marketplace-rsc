# frozen_string_literal: true

require 'rails_helper'

# Upgrades the feature pages from dispatch-only coverage to real render coverage.
#
# spec/routing/routes_spec.rb proves these routes still reach the right
# controller#action. That cannot catch a controller whose data assembly raises, a
# template that references a removed method, or a layout regression — all of which
# previously only failed in the ~20-minute browser gate. With the Node renderer
# replaced at its process boundary (spec/support/renderer_stub.rb), a request spec
# runs the real controller, data assembly and ERB, in milliseconds.
#
# Adapted from PR #147.
RSpec.describe 'Renderer stub isolation' do
  it 'leaves the renderer helpers untouched in untagged examples' do
    expect(ProductsController.instance_method(:stream_view_containing_react_components).owner)
      .to eq(ReactOnRailsPro::Stream)
    expect(ProductsController.view_context_class.instance_method(:react_component).owner)
      .to eq(ReactOnRails::Helper)
  end
end

RSpec.describe 'Feature pages', type: :request, renderer_stub: true do
  # Deterministic records for the id-scoped routes. RouteContract's example id is
  # substituted with the real record id at request time.
  let!(:restaurant) do
    Restaurant.create!(name: 'Feature Page Restaurant', cuisine_type: 'Test Kitchen', timezone: 'UTC')
  end

  let!(:product) do
    Product.create!(
      name: 'Feature Page Product',
      description: 'Deterministic product data for feature page request specs.',
      price: 100, category: 'Test Category', brand: 'Test Brand', sku: 'feature-page-product'
    )
  end

  def request_path_for(spec)
    spec.sub(':id', restaurant.id.to_s)
  end

  RouteContract::RENDERER_BACKED.each_key do |spec|
    if RouteContract::FLAG_GATED.key?(spec)
      it "GET #{spec} is skipped" do
        skip RouteContract::FLAG_GATED.fetch(spec)
      end
      next
    end

    it "GET #{spec} renders" do
      get request_path_for(spec)

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('data-renderer-stub="true"')
    end
  end

  # The stub replaces the renderer, not the controller, so the data the page would
  # stream is still assembled. Asserting that keeps the stub from silently hollowing
  # out the coverage these examples claim to provide.
  describe 'controller data assembly still runs' do
    it 'loads reviews for the RSC product page' do
      expect_any_instance_of(Product).to receive(:top_reviews).with(5).and_call_original

      get '/product/rsc'
    end

    it 'loads the restaurant detail payload for the cached RSC page' do
      expect(RestaurantDetailData).to receive(:for).with(an_instance_of(Restaurant)).and_call_original

      get "/restaurant/#{restaurant.id}/rsc-cached"
    end
  end
end

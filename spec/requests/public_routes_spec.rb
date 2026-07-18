# frozen_string_literal: true

require 'open3'
require 'rails_helper'

RSpec.describe 'Public route rendering isolation' do
  it 'leaves renderer methods unchanged in untagged examples' do
    expect(
      ProductsController.instance_method(:stream_view_containing_react_components).owner
    ).to eq(ReactOnRailsPro::Stream)
    expect(
      ProductsController.view_context_class.instance_method(:react_component).owner
    ).to eq(ReactOnRails::Helper)
  end
end

# rubocop:disable Metrics/BlockLength
RSpec.describe 'Public routes', type: :request, public_route_contract: true do
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
    it 'derives rendering-stub controllers from the public route contract' do
      expect(PUBLIC_ROUTE_CONTROLLERS).to eq(PublicRouteContract.controller_classes)
      expect(PUBLIC_ROUTE_CONTROLLERS).to contain_exactly(
        BlogController,
        CssDemoController,
        HomeController,
        MediaGalleryController,
        PagesController,
        ProductSearchController,
        ProductsController,
        RestaurantsController
      )
    end

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

    it 'derives Chromium paths from every rendered route and excludes redirects' do
      rendered_route_count = PublicRouteContract.routes.count do |route_case|
        route_case.fetch('expected_status') == 200
      end

      expect(PublicRouteContract.browser_route_paths.length).to eq(rendered_route_count)
      expect(PublicRouteContract.browser_route_paths).to include(
        '/restaurant/1/ssr-cached',
        '/how-rsc-works',
        '/lh-compare?left=blog_ssr-desktop&right=blog_rsc-desktop',
        '/media-gallery/rsc',
        '/css-demo/two/rsc-client',
        '/product-search/client'
      )
      expect(PublicRouteContract.browser_route_paths).not_to include('/source', '/search-performance')
      expect(PublicRouteContract.browser_route_paths).not_to include(a_string_matching(/:\w+/))
    end

    it 'keeps the Chromium verifier inventory identical to the canonical contract' do
      stdout, stderr, status = Open3.capture3(
        { 'PUPPETEER_EXECUTABLE_PATH' => '/bin/false' },
        'node',
        '.verify-routes.js',
        '--list-routes',
        chdir: Rails.root.to_s
      )

      expect(status).to be_success, stderr
      expect(JSON.parse(stdout)).to eq(PublicRouteContract.browser_route_paths)
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

  describe 'test rendering boundary' do
    it 'executes cached component props blocks' do
      expect_any_instance_of(Product).to receive(:top_reviews).with(10).and_call_original

      get '/product/ssr-cached'
    end

    it 'executes cached stream component props blocks' do
      expect(RestaurantDetailData).to receive(:for).with(an_instance_of(Restaurant)).and_call_original

      get "/restaurant/#{restaurant.id}/rsc-cached"
    end

    it 'executes async props blocks with an emitter' do
      expect_any_instance_of(Product).to receive(:top_reviews).with(5).and_call_original

      get '/product/rsc'

      expect(response.body).to include('data-route-contract-component="true"')
    end

    it 'executes cached async props blocks with an emitter' do
      expect_any_instance_of(Product).to receive(:top_reviews).with(5).and_call_original

      get '/product/rsc-cached'
    end

    [
      ['/product/rsc-cached', ProductsController, 'ProductPageRSC'],
      ['/product-search/rsc-cached', ProductSearchController, 'ProductSearchRSC'],
      ['/blog/rsc-cached', BlogController, 'BlogPostRSC']
    ].each do |path, controller, component_name|
      it "uses the app cache helper for #{path}" do
        expect_any_instance_of(controller.view_context_class)
          .to receive(:check_async_caching_options!)
          .and_call_original
        expect(ReactOnRailsPro::Cache)
          .to receive(:react_component_cache_key)
          .with(component_name, hash_including(:cache_key, prerender: true))
          .and_call_original

        get path
      end
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

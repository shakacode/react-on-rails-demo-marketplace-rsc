# frozen_string_literal: true

require 'rails_helper'

# The feature pages (product / blog / restaurant / product-search / css-demo /
# media-gallery variants) render React server-side via the Node renderer, so their
# full render + hydration is verified by the Puppeteer gate (.verify-routes.js /
# browser-smoke.yml) rather than by a request spec. These routing specs are the
# cheap, renderer-free guard that each of those routes still exists and dispatches
# to the controller#action the app expects — catching config/routes.rb regressions
# on every PR.
#
# The route list lives in spec/support/route_contract.rb so that
# spec/routing/route_coverage_spec.rb can prove it matches the real router.
RSpec.describe 'Feature page routes', type: :routing do
  shared_examples 'a dispatching route' do |spec, target|
    it "routes #{spec} to #{target}" do
      expect(get: RouteContract.example_path(spec))
        .to route_to(target, **RouteContract.dynamic_params(spec))
    end
  end

  describe 'renderer-backed pages' do
    RouteContract::RENDERER_BACKED.each do |spec, target|
      it_behaves_like 'a dispatching route', spec, target
    end
  end

  describe 'JSON API endpoints' do
    RouteContract::API_GET_ENDPOINTS.each do |spec, target|
      it_behaves_like 'a dispatching route', spec, target
    end

    # The only non-GET API route with a controller behind it, so it sits outside
    # the GET contract but still needs dispatch coverage.
    it 'routes POST /api/product_search/review_snippets' do
      expect(post: '/api/product_search/review_snippets')
        .to route_to('api/product_search#review_snippets')
    end
  end
end

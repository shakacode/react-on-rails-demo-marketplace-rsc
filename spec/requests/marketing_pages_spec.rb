# frozen_string_literal: true

require 'rails_helper'

# These pages do not server-render React (or render it with `prerender: false`),
# so a request spec fully exercises their controllers, the shared layout, and view
# helpers — the exact risk surface that app-level changes (layout/SEO/nav/routing/
# helpers) touch — without needing the JS renderer or a compiled asset bundle.
#
# The page list lives in spec/support/route_contract.rb so that
# spec/routing/route_coverage_spec.rb can prove it matches the real router.
RSpec.describe 'Marketing & content pages', type: :request do
  describe 'rendered pages' do
    RouteContract::RENDERED_PAGES.each do |path|
      it "GET #{path} returns 200 and renders the shared layout" do
        get path

        expect(response).to have_http_status(:ok)
        # The shared layout wraps every page; asserting on it catches layout /
        # nav / helper regressions on every one of these routes.
        expect(response.body).to include('Performance Demo')
      end
    end
  end

  describe 'conditional redirects' do
    RouteContract::CONDITIONAL_REDIRECT_PAGES.each do |path, target|
      it "GET #{path} redirects to #{target} when the report params are missing/invalid" do
        get path

        expect(response).to redirect_to(target)
      end
    end
  end

  describe 'health check' do
    RouteContract::HEALTH_ENDPOINTS.each do |path|
      it "GET #{path} returns 200" do
        get path

        expect(response).to have_http_status(:ok)
      end
    end
  end
end

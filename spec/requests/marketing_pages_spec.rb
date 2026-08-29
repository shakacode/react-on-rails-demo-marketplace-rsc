# frozen_string_literal: true

require 'rails_helper'

# These pages are plain ERB (no React server-rendering), so a request spec
# fully exercises their controllers, the shared layout, and view helpers — the
# exact risk surface that app-level changes (layout/SEO/nav/routing/helpers)
# touch — without needing the JS renderer or a compiled asset bundle.
RSpec.describe 'Marketing & content pages', type: :request do
  shared_examples 'a rendered page' do |path|
    it "GET #{path} returns 200 and renders the shared layout" do
      get path
      expect(response).to have_http_status(:ok)
      # The shared layout wraps every page; asserting on it catches layout /
      # nav / helper regressions on every one of these routes.
      expect(response.body).to include('Performance Demo')
    end
  end

  it_behaves_like 'a rendered page', '/'
  it_behaves_like 'a rendered page', '/why-rsc'
  it_behaves_like 'a rendered page', '/how-rsc-works'
  it_behaves_like 'a rendered page', '/measure'
  it_behaves_like 'a rendered page', '/rsc-performance'
  # Mounts a React component with `prerender: false`, so the server only emits
  # the hydration div — no Node renderer involved, unlike the */ssr and */rsc
  # feature pages.
  it_behaves_like 'a rendered page', '/ssr-rsc-playground'

  describe '/lh-compare' do
    it 'redirects to the reports index when the report params are missing/invalid' do
      get '/lh-compare'
      expect(response).to redirect_to('/lighthouse-reports/index.html')
    end
  end

  describe 'health check' do
    it 'GET /up returns 200' do
      get '/up'
      expect(response).to have_http_status(:ok)
    end
  end
end

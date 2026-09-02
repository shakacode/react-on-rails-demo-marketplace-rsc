# frozen_string_literal: true

require 'rails_helper'

# Targets come from spec/support/route_contract.rb, which sources the repository
# URL from the same ApplicationHelper::GITHUB_REPO_URL constant config/routes.rb
# uses, so a repo move only has to be made in one place.
RSpec.describe 'Redirects', type: :request do
  describe 'external project links' do
    RouteContract::EXTERNAL_PERMANENT_REDIRECTS.each do |path, target|
      it "GET #{path} permanently redirects (308) to #{target}" do
        get path

        expect(response).to have_http_status(:permanent_redirect)
        expect(response).to redirect_to(target)
        # Asserting on the Location header only; the off-site target is never
        # followed from a request spec.
      end
    end
  end

  describe 'renamed slugs' do
    RouteContract::INTERNAL_PERMANENT_REDIRECTS.each do |path, target|
      it "GET #{path} permanently redirects (308) to #{target}" do
        get path

        expect(response).to have_http_status(:permanent_redirect)
        expect(response).to redirect_to(target)
      end
    end
  end
end

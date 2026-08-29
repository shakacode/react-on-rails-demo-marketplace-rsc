# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Redirects', type: :request do
  # Sourced from the same constant config/routes.rb uses, so a repo move only
  # has to be made in one place.
  repo = ApplicationHelper::GITHUB_REPO_URL

  describe 'external project links' do
    {
      '/source' => repo,
      '/contributing' => "#{repo}/blob/main/CONTRIBUTING.md",
      '/issues' => "#{repo}/issues"
    }.each do |path, target|
      it "GET #{path} permanently redirects (308) to #{target}" do
        get path
        expect(response).to have_http_status(:permanent_redirect)
        expect(response).to redirect_to(target)
      end
    end
  end

  describe 'renamed slugs' do
    # /search-performance was renamed to /rsc-performance; the old slug is kept
    # as a permanent redirect so existing links and SEO equity survive.
    it 'GET /search-performance permanently redirects (308) to /rsc-performance' do
      get '/search-performance'
      expect(response).to have_http_status(:permanent_redirect)
      expect(response).to redirect_to('/rsc-performance')
    end
  end
end

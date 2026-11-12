# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::BlogPosts', type: :request do
  describe 'GET /api/blog_posts/:id/related_posts' do
    before do
      # The endpoint sleeps 1.5s to simulate a slow recommendation engine;
      # skip the artificial delay so the spec stays fast.
      allow_any_instance_of(Api::BlogPostsController).to receive(:sleep)
    end

    it 'returns related posts excluding the current post' do
      get '/api/blog_posts/2/related_posts'

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['posts']).to be_an(Array)
      expect(body['posts']).not_to be_empty
      expect(body['posts'].map { |p| p['id'] }).not_to include(2)
    end
  end
end

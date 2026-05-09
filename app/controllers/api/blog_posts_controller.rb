# frozen_string_literal: true

class Api::BlogPostsController < ApplicationController
  skip_forgery_protection
  def related_posts
    sleep(1.5) # Simulate slow recommendation engine
    post_id = params[:id]
    posts = BlogData.related_posts(post_id)

    render json: { posts: posts }
  end
end

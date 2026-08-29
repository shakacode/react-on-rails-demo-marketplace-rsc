# frozen_string_literal: true

require 'rails_helper'

# The feature pages (product / blog / restaurant / product-search / css-demo /
# media-gallery variants) render React server-side via the Node renderer, so
# their full render + hydration is verified by the Puppeteer gate
# (.verify-routes.js / browser-smoke.yml) rather than by a request spec. These
# routing specs are the cheap, renderer-free guard that each of those routes
# still exists and dispatches to the controller#action the app expects —
# catching config/routes.rb regressions on every PR.
#
# Each demo family exposes the same rendering variants, and the URL segment maps
# to the action name by replacing dashes with underscores
# (`/product/rsc-pull` -> `products#show_rsc_pull`), so the variants are listed
# as data rather than repeated by hand.
RSpec.describe 'Feature page routes', type: :routing do
  def action_for(variant, prefix)
    "#{prefix}_#{variant.tr('-', '_')}"
  end

  describe 'single pages' do
    it { expect(get: '/rsc').to route_to('home#rsc') }
    it { expect(get: '/products').to route_to('product_search#search_rsc') }
    it { expect(get: '/ssr-rsc-playground').to route_to('pages#ssr_rsc_playground') }
  end

  # Both paths intentionally hit the same RSC action.
  describe 'media gallery' do
    it { expect(get: '/media-gallery').to route_to('media_gallery#show_rsc') }
    it { expect(get: '/media-gallery/rsc').to route_to('media_gallery#show_rsc') }
  end

  describe 'product variants' do
    %w[ssr client rsc ssr-cached rsc-cached rsc-pull ppr].each do |variant|
      it { expect(get: "/product/#{variant}").to route_to("products##{action_for(variant, 'show')}") }
    end
  end

  describe 'restaurant detail variants' do
    %w[ssr client rsc ssr-cached rsc-cached].each do |variant|
      it do
        expect(get: "/restaurant/7/#{variant}")
          .to route_to("restaurants##{action_for(variant, 'show')}", id: '7')
      end
    end
  end

  describe 'product search variants' do
    %w[ssr client rsc ssr-cached rsc-cached].each do |variant|
      it do
        expect(get: "/product-search/#{variant}")
          .to route_to("product_search##{action_for(variant, 'search')}")
      end
    end
  end

  describe 'blog variants' do
    variants = %w[
      ssr client rsc rsc-simple
      ssr-cached rsc-cached rsc-simple-cached
      rsc-step1 rsc-step1b rsc-step1c rsc-step2 rsc-step3 rsc-step4 rsc-step5
    ]

    variants.each do |variant|
      it { expect(get: "/blog/#{variant}").to route_to("blog##{action_for(variant, 'post')}") }
    end
  end

  # CSS code-splitting experiment: two pages x three rendering shapes.
  describe 'css demo variants' do
    %w[one two].each do |page|
      %w[ssr rsc-server rsc-client].each do |shape|
        it do
          expect(get: "/css-demo/#{page}/#{shape}")
            .to route_to("css_demo##{action_for(shape, page)}")
        end
      end
    end
  end

  describe 'api endpoints' do
    it { expect(get: '/api/products/3/reviews').to route_to('api/products#reviews', id: '3') }
    it { expect(get: '/api/products/3/review_stats').to route_to('api/products#review_stats', id: '3') }
    it { expect(get: '/api/products/3/related_products').to route_to('api/products#related_products', id: '3') }
    it { expect(get: '/api/restaurants/3/detail').to route_to('api/restaurants#detail', id: '3') }
    it { expect(get: '/api/blog_posts/3/related_posts').to route_to('api/blog_posts#related_posts', id: '3') }
    it { expect(get: '/api/product_search/results').to route_to('api/product_search#results') }
    it { expect(get: '/api/product_search/facets').to route_to('api/product_search#facets') }
    it { expect(post: '/api/product_search/review_snippets').to route_to('api/product_search#review_snippets') }
  end
end

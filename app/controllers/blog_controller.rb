# frozen_string_literal: true

class BlogController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[
    post_rsc post_rsc_cached post_rsc_simple post_rsc_simple_cached
    post_rsc_step1 post_rsc_step1b post_rsc_step1c
    post_rsc_step2 post_rsc_step3 post_rsc_step4 post_rsc_step5
  ]

  before_action :set_seo_meta

  SEO_VARIANTS = {
    "post_ssr" => "Server-Side Rendering (SSR)",
    "post_client" => "Client-Side Rendering",
    "post_rsc" => "React Server Components (RSC)"
  }.freeze

  # V1: Full SSR — all data fetched and rendered on server
  # In SSR, the content fetch delay blocks the ENTIRE response — no HTML is sent
  # until all data is ready, because Rails must render the full page before streaming.
  def post_ssr
    content_delay = ENV.fetch("CONTENT_DELAY_MS", "0").to_f / 1000
    sleep(content_delay) if content_delay > 0
    post = BlogData.find_post(1)
    @post_data = post
    @related_posts = BlogData.related_posts(post[:id])
  end

  # V2: Client Components — basic post SSRed, related posts fetched client-side
  def post_client
    @post_data = BlogData.find_post(1)
  end

  # V3: RSC Streaming — markdown rendered server-side, related posts streamed
  # Only small metadata as sync props (keeps RSC cache key ~1.5KB vs ~28KB).
  # The heavy content (~25KB markdown) streams as an async prop.
  # In RSC, the content fetch delay only blocks the content stream — the header
  # and skeleton render immediately because sync props (post_meta) are instant.
  def post_rsc
    post = BlogData.find_post(1)
    @post_meta = post.except(:content)
    @content_delay = ENV.fetch("CONTENT_DELAY_MS", "0").to_f / 1000
    stream_view_containing_react_components(template: "blog/post_rsc")
  end

  # V3 cached: identical RSC streaming to post_rsc, but the view wraps the component in
  # cached_stream_react_component_with_async_props. The first request is a cold miss that streams live
  # and writes every chunk through to the cache; subsequent requests are cache hits that replay those
  # chunks and skip the content fetch, the two simulated sleeps, and the node-renderer round-trip.
  def post_rsc_cached
    post = BlogData.find_post(1)
    @post_meta = post.except(:content)
    @content_delay = ENV.fetch("CONTENT_DELAY_MS", "0").to_f / 1000
    stream_view_containing_react_components(template: "blog/post_rsc_cached")
  end

  # V4: RSC Simple — markdown rendered server-side, all data passed upfront
  def post_rsc_simple
    post = BlogData.find_post(1)
    @post_data = post
    @related_posts = BlogData.related_posts(post[:id])
    stream_view_containing_react_components(template: "blog/post_rsc_simple")
  end

  # V1 cached: cached_react_component. Props (incl. the simulated content delay) are built lazily in
  # the view block, so on a cache hit the data fetch, the delay, and the prerender are all skipped.
  def post_ssr_cached; end

  # V4 cached: cached_stream_react_component (plain stream, no async props). On a hit the streamed
  # chunks replay and the data fetch + node render are skipped.
  def post_rsc_simple_cached
    stream_view_containing_react_components(template: "blog/post_rsc_simple_cached")
  end

  # === RSC debug steps (incremental complexity) ===

  # Step 1: Pure text, zero deps
  def post_rsc_step1
    stream_view_containing_react_components(template: "blog/post_rsc_step1")
  end

  # Step 1b: Pure text but with post props (isolate: is it the props or the imports?)
  def post_rsc_step1b
    @post_data = BlogData.find_post(1)
    stream_view_containing_react_components(template: "blog/post_rsc_step1b")
  end

  # Step 1c: Simplest possible props (string + number)
  def post_rsc_step1c
    stream_view_containing_react_components(template: "blog/post_rsc_step1c")
  end

  # Step 2: Imports BlogPostHeader (server component)
  def post_rsc_step2
    @post_data = BlogData.find_post(1)
    stream_view_containing_react_components(template: "blog/post_rsc_step2")
  end

  # Step 3: Adds InteractiveSection ('use client' component)
  def post_rsc_step3
    @post_data = BlogData.find_post(1)
    stream_view_containing_react_components(template: "blog/post_rsc_step3")
  end

  # Step 4: Adds marked (no highlight.js)
  def post_rsc_step4
    @post_data = BlogData.find_post(1)
    stream_view_containing_react_components(template: "blog/post_rsc_step4")
  end

  # Step 5: Adds full renderMarkdown (marked + highlight.js)
  def post_rsc_step5
    @post_data = BlogData.find_post(1)
    stream_view_containing_react_components(template: "blog/post_rsc_step5")
  end

  private

  # The three headline variants are indexable; the "simple" and incremental
  # debug-step pages are noindexed so they don't dilute the demo in search.
  def set_seo_meta
    variant = SEO_VARIANTS[action_name]
    if variant
      @page_title = "Blog Post — #{variant} | React on Rails RSC Demo"
    else
      @robots = "noindex, follow"
    end
    @page_description =
      "A markdown-heavy blog post showing how React Server Components cut JavaScript " \
      "bundle size versus SSR and client-side rendering."
  end
end

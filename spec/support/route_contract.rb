# frozen_string_literal: true

# The canonical contract for every app-owned public GET route (issue #142).
#
# Each route belongs to exactly one bucket below, and spec/routing/route_coverage_spec.rb
# asserts that the buckets and `Rails.application.routes` agree in both directions:
# a new route added without a case fails, and a contract entry left behind after a
# route is deleted fails too. That second direction is the one that matters here —
# this suite previously drifted ~20 routes out of date over three months.
#
# The buckets exist because the demo's pages do not share a single verification
# strategy. Anything rendered with `prerender: true` goes through the external Node
# renderer and needs built bundles, so it cannot be request-spec'd; those routes get
# `controller#action` dispatch coverage here and render/hydration coverage from the
# Puppeteer gate (browser-smoke.yml) instead.
#
# Deliberately out of scope, so they never appear in the buckets:
#   * Non-GET endpoints. The two POSTs (`/api/product_search/review_snippets` and the
#     dead `/api/performance_metrics`, see #189) are not part of a GET page contract;
#     the former still has its own request spec.
#   * Framework-owned routes, which are listed in EXCLUSIONS with a rationale.
module RouteContract
  # Dynamic segments need a deterministic value so the routing assertions are
  # reproducible. Nothing is fetched from the database — these specs assert
  # dispatch, not that a record exists.
  DYNAMIC_SEGMENT_EXAMPLES = { id: '7' }.freeze

  # Builds `{ "/product/rsc-pull" => "products#show_rsc_pull" }` from a variant list.
  # Every demo family follows the same shape: the URL segment maps to the action name
  # by replacing dashes with underscores.
  def self.variants(prefix, segments, controller, action_prefix)
    segments.to_h do |segment|
      ["#{prefix}/#{segment}", "#{controller}##{action_prefix}_#{segment.tr('-', '_')}"]
    end
  end

  # Renderer-free pages: rendered by a request spec, asserting 200 + the shared layout.
  RENDERED_PAGES = [
    '/',
    '/why-rsc',
    '/how-rsc-works',
    '/measure',
    '/rsc-performance',
    # Mounts React with `prerender: false`, so the server only emits the hydration
    # div — no Node renderer involved, unlike the */ssr and */rsc feature pages.
    '/ssr-rsc-playground'
  ].freeze

  # Returns 200 but renders no application layout, so it gets its own assertion.
  HEALTH_ENDPOINTS = ['/up'].freeze

  # Renders a page when given a valid report, and redirects otherwise. The spec
  # covers the redirect branch, which is what a missing/invalid param produces.
  CONDITIONAL_REDIRECT_PAGES = {
    '/lh-compare' => '/lighthouse-reports/index.html'
  }.freeze

  # Permanent (308) redirects off-site. Asserted on status + target; never followed.
  EXTERNAL_PERMANENT_REDIRECTS = {
    '/source' => ApplicationHelper::GITHUB_REPO_URL,
    '/contributing' => "#{ApplicationHelper::GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md",
    '/issues' => "#{ApplicationHelper::GITHUB_REPO_URL}/issues"
  }.freeze

  # Renamed slugs kept as permanent redirects so existing links and SEO equity survive.
  INTERNAL_PERMANENT_REDIRECTS = {
    '/search-performance' => '/rsc-performance'
  }.freeze

  BLOG_VARIANTS = %w[
    ssr client rsc rsc-simple
    ssr-cached rsc-cached rsc-simple-cached
    rsc-step1 rsc-step1b rsc-step1c rsc-step2 rsc-step3 rsc-step4 rsc-step5
  ].freeze

  # CSS code-splitting experiment: two pages x three rendering shapes.
  CSS_DEMO = %w[one two].index_with { %w[ssr rsc-server rsc-client] }.freeze

  # Server-rendered through the Node renderer, so only dispatch is asserted here.
  RENDERER_BACKED = {
    '/rsc' => 'home#rsc',
    '/products' => 'product_search#search_rsc',
    # Both paths intentionally hit the same RSC action.
    '/media-gallery' => 'media_gallery#show_rsc',
    '/media-gallery/rsc' => 'media_gallery#show_rsc',
    **variants('/restaurant/:id', %w[ssr client rsc ssr-cached rsc-cached ssr-virtual rsc-virtual],
               'restaurants', 'show'),
    **variants('/product', %w[ssr client rsc ssr-cached rsc-cached rsc-pull ppr], 'products', 'show'),
    **variants('/product-search', %w[ssr client rsc ssr-cached rsc-cached], 'product_search', 'search'),
    **variants('/blog', BLOG_VARIANTS, 'blog', 'post'),
    **CSS_DEMO.reduce({}) { |acc, (page, shapes)| acc.merge(variants("/css-demo/#{page}", shapes, 'css_demo', page)) }
  }.freeze

  # Routes declared unconditionally in config/routes.rb whose implementation is behind
  # an environment flag. They keep dispatch coverage, but rendering them needs the flag,
  # so spec/requests/feature_pages_spec.rb skips them with the reason attached.
  FLAG_GATED = {
    '/product/ppr' => 'Partial Prerendering patches load only when ENABLE_PPR=true ' \
                      '(config/initializers/ppr_patches.rb). Without it the view calls an ' \
                      'undefined ppr_react_component and the route 500s.'
  }.freeze

  # JSON endpoints, covered by request specs against real payloads.
  API_GET_ENDPOINTS = {
    '/api/restaurants/:id/detail' => 'api/restaurants#detail',
    '/api/products/:id/reviews' => 'api/products#reviews',
    '/api/products/:id/review_stats' => 'api/products#review_stats',
    '/api/products/:id/related_products' => 'api/products#related_products',
    '/api/product_search/results' => 'api/product_search#results',
    '/api/product_search/facets' => 'api/product_search#facets',
    '/api/blog_posts/:id/related_posts' => 'api/blog_posts#related_posts'
  }.freeze

  # Routes this app does not own. Adding an entry here is the documented escape
  # hatch from the coverage assertion, and requires a reason.
  EXCLUSIONS = [
    { pattern: %r{\A/assets\z}, reason: 'Shakapacker asset mount, not an app page' },
    { pattern: %r{\A/cable\z}, reason: 'Action Cable mount' },
    { pattern: %r{\A/rsc_payload/}, reason: 'react_on_rails_pro framework route; exercised by the RSC browser gate' },
    { pattern: %r{\A/rails/}, reason: 'Rails-owned: Active Storage, Action Mailbox, and the mailbox conductor' },
    { pattern: /_historical_location\z/, reason: 'turbo-rails framework routes' }
  ].freeze

  # Every path spec the contract claims to cover.
  def self.declared_specs
    [
      *RENDERED_PAGES,
      *HEALTH_ENDPOINTS,
      *CONDITIONAL_REDIRECT_PAGES.keys,
      *EXTERNAL_PERMANENT_REDIRECTS.keys,
      *INTERNAL_PERMANENT_REDIRECTS.keys,
      *RENDERER_BACKED.keys,
      *API_GET_ENDPOINTS.keys
    ].uniq.sort
  end

  # Every app-owned GET path spec the router actually knows about. Engine mounts are
  # treated as GET-serving and so have to be excluded explicitly (see EXCLUSIONS)
  # rather than slipping through on a technicality.
  def self.routed_specs
    Rails.application.routes.routes
         .select { |route| serves_get?(route) }
         .map { |route| path_spec(route) }
         .reject { |spec| excluded?(spec) }
         .uniq
         .sort
  end

  # Mounted engines report an empty verb because they answer every method.
  def self.serves_get?(route)
    verb = route.verb.to_s
    verb.empty? || verb.include?('GET')
  end

  def self.path_spec(route)
    route.path.spec.to_s.sub(/\(\.:format\)\z/, '')
  end

  def self.excluded?(spec)
    EXCLUSIONS.any? { |exclusion| exclusion[:pattern].match?(spec) }
  end

  # The Puppeteer gate runs against a `db:prepare`-seeded database rather than
  # spec-built records, so its id-scoped routes use the seeded id rather than
  # DYNAMIC_SEGMENT_EXAMPLES.
  BROWSER_SEGMENT_VALUES = { id: '1' }.freeze

  # Every route the browser gate should open: the pages that render HTML, minus the
  # ones behind a flag. Redirects, the health endpoint and the JSON API are excluded
  # because there is nothing for a browser to render.
  def self.browser_route_paths
    specs = RENDERED_PAGES + RENDERER_BACKED.keys - FLAG_GATED.keys

    specs.map { |spec| spec.gsub(/:(\w+)/) { BROWSER_SEGMENT_VALUES.fetch(Regexp.last_match(1).to_sym) } }
         .uniq
         .sort
  end

  # The controller classes behind the contract's page routes. spec/support/renderer_stub.rb
  # scopes its stubs to exactly these, so a controller outside the contract keeps its
  # real rendering behaviour.
  def self.controller_classes
    (RENDERER_BACKED.values + page_controller_targets)
      .map { |target| "#{target.split('#').first.camelize}Controller".constantize }
      .uniq
  end

  # Controllers behind RENDERED_PAGES / CONDITIONAL_REDIRECT_PAGES, which the router
  # resolves rather than the contract naming them directly.
  def self.page_controller_targets
    (RENDERED_PAGES + CONDITIONAL_REDIRECT_PAGES.keys).filter_map do |path|
      route = Rails.application.routes.recognize_path(path, method: :get)
      "#{route[:controller]}##{route[:action]}"
    rescue ActionController::RoutingError
      nil
    end
  end

  # '/restaurant/:id/ssr' => '/restaurant/7/ssr'
  def self.example_path(spec)
    spec.gsub(/:(\w+)/) { DYNAMIC_SEGMENT_EXAMPLES.fetch(Regexp.last_match(1).to_sym) }
  end

  # '/restaurant/:id/ssr' => { id: '7' }
  def self.dynamic_params(spec)
    spec.scan(/:(\w+)/).flatten.to_h { |name| [name.to_sym, DYNAMIC_SEGMENT_EXAMPLES.fetch(name.to_sym)] }
  end
end

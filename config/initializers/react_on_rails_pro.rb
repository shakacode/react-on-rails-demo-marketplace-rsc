# frozen_string_literal: true

ReactOnRailsPro.configure do |config|
  # Enable RSC (React Server Components) support
  config.enable_rsc_support = true

  # RSC bundle file name
  config.rsc_bundle_js_file = 'rsc-bundle.js'

  # Use Node renderer for server-side rendering
  config.server_renderer = 'NodeRenderer'
  config.renderer_use_fallback_exec_js = false

  # Renderer URL for the Node.js server
  config.renderer_url = ENV.fetch('RENDERER_URL', 'http://localhost:3800')

  # Password for node renderer authentication (must match node-renderer.js)
  config.renderer_password = ENV.fetch('RENDERER_PASSWORD', 'development_password')

  # RSC payload generation URL path
  config.rsc_payload_generation_url_path = 'rsc_payload/'

  # Copy loadable-stats.json to the node renderer for @loadable/server ChunkExtractor.
  # Always copied so the SSR bundle's ChunkExtractor can resolve async chunks even
  # in HMR dev mode (otherwise client-variant pages 500 with "cannot find … in stats").
  config.assets_to_copy = Rails.root.join("public", "packs", "loadable-stats.json")
end

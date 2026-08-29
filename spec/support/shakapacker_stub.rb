# frozen_string_literal: true

# Decouple request/view specs from the compiled asset bundle.
#
# In the test environment Shakapacker is configured with `compile: true`, so the
# first request that renders a pack tag against a missing or stale manifest would
# trigger a full webpack build (slow, requires the JS toolchain + RSC pack
# generation). Request specs only need to prove that controllers, routes, views,
# helpers and the layout render without error — not that the asset bundle is
# built. Returning empty tags keeps the suite fast and hermetic; actual asset /
# hydration correctness is covered by the Puppeteer route-hydration gate
# (.verify-routes.js / rsc-rspack-e2e.yml).
#
# Every view-facing pack helper is neutralized (not just the two used today) so a
# view that later reaches for, say, `append_javascript_pack_tag` or
# `image_pack_tag` doesn't silently pull the suite back onto the webpack path.
module ShakapackerSpecStub
  PACK_HELPERS = %i[
    stylesheet_pack_tag
    javascript_pack_tag
    append_stylesheet_pack_tag
    append_javascript_pack_tag
    prepend_javascript_pack_tag
    image_pack_tag
    favicon_pack_tag
    preload_pack_asset
    asset_pack_path
    asset_pack_url
    image_pack_path
  ].freeze

  PACK_HELPERS.each do |helper|
    define_method(helper) { |*, **| '' }
  end
end

Shakapacker::Helper.prepend(ShakapackerSpecStub)

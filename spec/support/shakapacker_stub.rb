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

# Neutralizing the view helpers is not sufficient on its own.
#
# `react_component` reaches Shakapacker through react_on_rails rather than
# through those helpers: with `auto_load_bundle` enabled it calls
# `load_pack_for_generated_component`, whose manifest lookup triggers
# `Shakapacker::Compiler#compile` because the test environment sets
# `compile: true`. That runs the `rake react_on_rails:generate_packs` precompile
# hook and then shells out to `pnpm exec webpack` — which this repo does not even
# have installed, since it builds with rspack. The compile fails, the request
# still succeeds, and the suite silently pays ~13s per affected example for a
# build whose output it never uses.
#
# Stubbing the compiler keeps that cost out of the suite. Request specs assert
# that controllers, routes, views, helpers and the layout render without error;
# actual asset and hydration correctness is covered by the Puppeteer route
# gate (.verify-routes.js / browser-smoke.yml), which builds for real.
module ShakapackerCompilerSpecStub
  def compile
    true
  end

  def stale?
    false
  end
end

Shakapacker::Compiler.prepend(ShakapackerCompilerSpecStub)

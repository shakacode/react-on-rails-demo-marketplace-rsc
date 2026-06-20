# frozen_string_literal: true

# CSS code-splitting experiment (does each page download only the CSS its components need?).
# Three rendering shapes per page, sharing the same big CSS Modules (cssShared/cssA/cssB):
#   *_ssr        - SSR via react_component (client component → per-component CSS in the client pack)
#   *_rsc_server - RSC streamed, CSS imported by SERVER components (CSS lives in the RSC/server bundle)
#   *_rsc_client - RSC streamed, CSS imported by nested 'use client' leaves (RSC client-reference CSS)
# Page One uses Shared + A; Page Two uses Shared + B — so cssShared is shared, cssA/cssB are per-page.
class CssDemoController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[one_rsc_server two_rsc_server one_rsc_client two_rsc_client]

  def one_ssr; end
  def two_ssr; end

  # FIX for the server-component-CSS gap: a pure server component's CSS lives only in the
  # RSC/server bundle and never reaches the browser, so the streamed markup renders unstyled.
  # The fix links the page's exact CSS set (page one = cssShared + cssA) from a client-built
  # carrier pack via `append_stylesheet_pack_tag` — done at the TOP of the rsc-server view
  # templates (a view-helper; not available on the controller), exactly like the gem's own
  # `load_pack_for_generated_component` appends during the template render. Rails renders the
  # view before the layout, so the <link> lands in the layout's `stylesheet_pack_tag` in the
  # <head> (flushed before the streamed body paints → no FOUC). Scoped per route, no over-fetch.
  def one_rsc_server
    stream_view_containing_react_components(template: 'css_demo/one_rsc_server')
  end

  def two_rsc_server
    stream_view_containing_react_components(template: 'css_demo/two_rsc_server')
  end

  def one_rsc_client
    stream_view_containing_react_components(template: 'css_demo/one_rsc_client')
  end

  def two_rsc_client
    stream_view_containing_react_components(template: 'css_demo/two_rsc_client')
  end
end

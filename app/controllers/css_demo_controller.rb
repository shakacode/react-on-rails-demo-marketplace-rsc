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

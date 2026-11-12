# frozen_string_literal: true

# MediaGalleryController — the multimedia showcase page (issue #98).
#
# Single RSC variant (the page is "RSC-first" per the brief: use server
# components wherever possible). It follows the exact same streaming setup as
# RestaurantsController#show_rsc:
#   - include the two react-on-rails-pro concerns
#   - enable async react rendering for the streamed action
#   - render via stream_view_containing_react_components (NOT a plain render)
class MediaGalleryController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: %i[show_rsc]

  before_action :set_seo_meta

  # GET /media-gallery (and /media-gallery/rsc)
  def show_rsc
    @gallery = MediaGalleryData.build
    stream_view_containing_react_components(template: 'media_gallery/show_rsc')
  end

  private

  def set_seo_meta
    @page_title = 'Multimedia Showcase — React Server Components (RSC) | React on Rails RSC Demo'
    @page_description =
      'A media-heavy page (HLS video via react-player light mode and vanilla hls.js, ' \
      'plus responsive image galleries with react-image-lightbox and yet-another-react-lightbox) ' \
      'rendered RSC-first: only the interactive players and lightboxes ship JavaScript.'
  end
end

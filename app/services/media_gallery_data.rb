# frozen_string_literal: true

# MediaGalleryData — server-side manifest for the /media-gallery RSC demo page.
#
# WHY a data service (mirrors RestaurantDetailData.for / the repo convention):
# the whole "media manifest" (which videos, which images, their posters, srcsets,
# captions) is assembled ONCE on the server and handed to the RSC tree as props.
# Nothing about *what* to render needs the browser, so it stays here. Only the
# interactive players/lightboxes become client islands (see app/javascript/components/multimedia).
#
# This page is the landing point for a series of standalone experiments
# (react-player v2-vs-v3 web-vitals, an hls.js best-of-both player, and a
# react-image-lightbox vs yet-another-react-lightbox comparison). The asset
# choices below are deliberate and encode findings from those experiments —
# see the inline notes.
class MediaGalleryData
  # Returns the full props hash for MediaGalleryRSC. Snake_case keys to match the
  # repo convention (the TS layer maps them) — see RestaurantDetailData#build.
  def self.build
    new.build
  end

  def build
    {
      intro_markdown: INTRO_MARKDOWN,
      closing_markdown: CLOSING_MARKDOWN,
      react_player_video: react_player_video,
      vanilla_video: vanilla_video,
      ril_gallery: gallery(RIL_IMAGE_IDS, 'ril'),
      yarl_gallery: gallery(YARL_IMAGE_IDS, 'yarl')
    }
  end

  private

  # ---------------------------------------------------------------------------
  # VIDEO 1 — react-player v3 in "light" mode.
  #
  # Source: Mux's public test asset. We use Mux specifically because the video
  # experiments found that raw HLS hosts (Apple BipBop, plain .m3u8) have NO
  # thumbnail service, whereas Mux exposes a real-frame image endpoint
  # (image.mux.com/{id}/thumbnail.jpg?time=) — so the poster is an actual frame
  # of the video, not a placeholder. A matching poster is what makes light mode
  # (and the LCP story) honest: the same image the player shows before play.
  # ---------------------------------------------------------------------------
  MUX_PLAYBACK_ID = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe'

  def react_player_video
    {
      src: "https://stream.mux.com/#{MUX_PLAYBACK_ID}.m3u8",
      poster: "https://image.mux.com/#{MUX_PLAYBACK_ID}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop&time=12",
      title: 'react-player v3 — light (facade) mode',
      width: 1280,
      height: 720
    }
  end

  # ---------------------------------------------------------------------------
  # VIDEO 2 — vanilla <video> + hls.js (no React player library).
  #
  # Source: the classic Tears-of-Steel test stream on Mux's CDN. The experiments
  # used this exact stream; it has NO companion image service (image.mux.com only
  # works for real playback IDs, not this legacy path — confirmed 404 in the
  # experiment), which is precisely why we must supply our OWN poster here. That
  # contrast (Mux real-frame poster above vs. self-supplied poster here) is a
  # deliberate teaching point.
  # ---------------------------------------------------------------------------
  def vanilla_video
    {
      src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      # Self-supplied poster (the stream has no thumbnail endpoint). Picsum gives
      # us a stable, openly-licensed 16:9 image with explicit dimensions so the
      # <video> reserves the right box and CLS stays ~0 before playback.
      poster: 'https://picsum.photos/seed/hls-vanilla-poster/1280/720',
      title: 'vanilla <video> + hls.js',
      width: 1280,
      height: 720
    }
  end

  # ---------------------------------------------------------------------------
  # IMAGE GALLERIES.
  #
  # Two galleries render the SAME kind of responsive image grid but open two
  # different lightbox libraries, so you can compare them side by side:
  #   - react-image-lightbox (deprecated/archived, still ~130k downloads/wk)
  #   - yet-another-react-lightbox (its actively-maintained, React-19 successor)
  # The lightbox-library investigation recommended migrating to the latter; this
  # page lets you feel the difference in the same context.
  #
  # Picsum is used (not the local /seed-images) because it serves arbitrary
  # dimensions on demand, which lets us build a REAL responsive srcset
  # (400w/800w/1200w) — one of the issue's acceptance criteria. Each image has
  # explicit width/height (intrinsic 3:2) so the grid reserves layout space and
  # CLS stays ~0; below-the-fold thumbs lazy-load.
  # ---------------------------------------------------------------------------
  RIL_IMAGE_IDS = [1015, 1016, 1018, 1019, 1024, 1025, 1033, 1036].freeze
  YARL_IMAGE_IDS = [1037, 1038, 1039, 1043, 1044, 1047, 1050, 1051].freeze

  THUMB_W = 600
  THUMB_H = 400 # 3:2

  def gallery(ids, key_prefix)
    ids.map { |id| image_entry(id, key_prefix) }
  end

  # Grid columns: 4 on desktop, 2 on tablet, 1 on phone — drives the `sizes` hint.
  THUMB_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'

  def image_entry(id, key_prefix)
    {
      id: "#{key_prefix}-#{id}",
      thumb_src: picsum(id, THUMB_W, THUMB_H), srcset: thumb_srcset(id), sizes: THUMB_SIZES,
      width: THUMB_W, height: THUMB_H,
      full_src: picsum(id, 1600, 1067), # full-resolution image opened in the lightbox
      alt: "Open-licensed photo ##{id} from the Lorem Picsum collection",
      caption: "Lorem Picsum ##{id} — responsive srcset (400/800/1200w), explicit 3:2 box, lazy below the fold."
    }
  end

  # Builds the responsive srcset string the browser uses to pick a file size.
  def thumb_srcset(id)
    [
      "#{picsum(id, 400, 267)} 400w",
      "#{picsum(id, 800, 533)} 800w",
      "#{picsum(id, 1200, 800)} 1200w"
    ].join(', ')
  end

  def picsum(id, width, height)
    "https://picsum.photos/id/#{id}/#{width}/#{height}"
  end

  INTRO_MARKDOWN = <<~MD
    # Multimedia showcase

    A media-heavy page rendered the **React Server Components** way: the page shell,
    section layout, and this very copy are produced on the server and stream as
    HTML — **zero** of this text ships as JavaScript. Only the genuinely interactive
    pieces (the two video players and the two image lightboxes) hydrate as small
    **client islands**.

    Everything below distills hands-on experiments into one page:

    - **Video, two ways** — `react-player` v3 in *light/facade* mode vs. a hand-rolled
      `<video>` + `hls.js`. Both defer the heavy player/streaming JS until you click,
      which is the single biggest LCP win the benchmarks found.
    - **Image gallery, two ways** — the same responsive grid wired to
      `react-image-lightbox` and to its maintained successor
      `yet-another-react-lightbox`.

    Read the code comments for *why* each choice was made — they cite the
    measurements behind them.
  MD

  CLOSING_MARKDOWN = <<~MD
    ## Why this is CLS-safe

    Every media slot reserves its space **before** the heavy widget loads: videos sit
    in a fixed `16:9` box behind a real poster frame, and gallery thumbnails declare
    explicit `width`/`height` (intrinsic `3:2`). So when `hls.js`, `react-player`, or a
    lightbox finally hydrates, nothing reflows — Cumulative Layout Shift stays ~0.

    This mirrors the established SSR / Client / RSC demo pages: the markup you can
    render on the server, we render on the server; the browser only gets JavaScript
    for the parts that truly need it.
  MD
end

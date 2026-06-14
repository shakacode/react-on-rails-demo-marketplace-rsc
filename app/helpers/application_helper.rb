# frozen_string_literal: true

# SEO / meta-tag helpers shared by every page through the application layout.
#
# A page sets its own title/description/robots either from a view:
#
#   <% content_for(:page_title)       { "My specific title" } %>
#   <% content_for(:page_description) { "A one-sentence summary for search results." } %>
#   <% content_for(:robots)           { "noindex, follow" } %>
#
# ...or from a controller (handy for the many demo variants):
#
#   @page_title = "Product Page — SSR"
#   @robots     = "noindex, follow"
#
# Anything not set falls back to the site-wide defaults below.
module ApplicationHelper
  SITE_NAME = "React on Rails RSC Demo"
  CANONICAL_HOST = "https://rsc.reactonrails.com"
  OG_IMAGE_PATH = "/og-image.png"

  # Canonical GitHub repo. Single source of truth for the footer/nav source
  # links (config/routes.rb) and the deployed-commit URL (BuildMetadata).
  GITHUB_REPO_URL = "https://github.com/shakacode/react-server-components-marketplace-demo"

  DEFAULT_TITLE =
    "React Server Components for Ruby on Rails — Live Demo & Benchmarks"
  DEFAULT_DESCRIPTION =
    "A live demo of React Server Components (RSC) on Ruby on Rails. Compare RSC, " \
    "SSR, and client-side rendering side by side, backed by 24 independent " \
    "Lighthouse audits."

  # Memoized so the three call sites in the layout head (title, og:title,
  # twitter:title) resolve to one consistent value even under HTTP streaming.
  def seo_title(default = DEFAULT_TITLE)
    @seo_title ||=
      if content_for?(:page_title)
        content_for(:page_title)
      else
        @page_title.presence || default
      end
  end

  def seo_description(default = DEFAULT_DESCRIPTION)
    @seo_description ||= begin
      value = content_for?(:page_description) ? content_for(:page_description) : @page_description
      (value.presence || default).squish
    end
  end

  # Absolute canonical URL for the current request with any query string
  # stripped, so ?delay=… and other variants collapse to one canonical page.
  def canonical_url
    "#{CANONICAL_HOST}#{request.path}"
  end

  def og_image_url
    "#{CANONICAL_HOST}#{OG_IMAGE_PATH}"
  end

  def robots_directive
    return content_for(:robots) if content_for?(:robots)

    @robots.presence || "index, follow"
  end

  # schema.org JSON-LD describing the site and its publisher. Rendered once,
  # site-wide, in the layout <head>.
  def structured_data
    json = JSON.generate(
      [
        {
          "@context" => "https://schema.org",
          "@type" => "WebSite",
          "name" => SITE_NAME,
          "url" => "#{CANONICAL_HOST}/",
          "description" => DEFAULT_DESCRIPTION.squish
        },
        {
          "@context" => "https://schema.org",
          "@type" => "Organization",
          "name" => "ShakaCode",
          "url" => "https://www.shakacode.com",
          "sameAs" => [
            "https://github.com/shakacode",
            "https://github.com/shakacode/react_on_rails",
            "https://forum.shakacode.com/c/reactjs"
          ]
        }
      ]
    )
    # json_escape neutralises <, >, & (so a stray "</script>" in any value can
    # never break out of the script element); .html_safe then stops ActionView
    # from re-escaping the result back into invalid JSON-LD.
    # rubocop:disable Rails/OutputSafety
    json_escape(json).html_safe
    # rubocop:enable Rails/OutputSafety
  end
end

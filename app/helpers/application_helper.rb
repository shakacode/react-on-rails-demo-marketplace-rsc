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

  DEFAULT_TITLE =
    "React Server Components for Ruby on Rails — Live Demo & Benchmarks"
  DEFAULT_DESCRIPTION =
    "A live demo of React Server Components (RSC) on Ruby on Rails. Compare RSC, " \
    "SSR, and client-side rendering side by side, backed by 24 independent " \
    "Lighthouse audits."

  def seo_title(default = DEFAULT_TITLE)
    return content_for(:page_title) if content_for?(:page_title)

    @page_title.presence || default
  end

  def seo_description(default = DEFAULT_DESCRIPTION)
    raw = content_for?(:page_description) ? content_for(:page_description) : @page_description
    (raw.presence || default).squish
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
    JSON.generate(
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
  end
end

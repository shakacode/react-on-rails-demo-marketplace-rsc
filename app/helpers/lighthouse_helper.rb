# frozen_string_literal: true

module LighthouseHelper
  # Given a single LH report basename ("blog_ssr-desktop", "product_rsc-mobile", …)
  # return the URL for the side-by-side compare page paired against the
  # opposite-end variant for the same feature/strategy.
  #
  #   ssr|client → paired with rsc (clicked variant on the left)
  #   rsc        → paired with ssr (clicked variant on the right)
  def lh_compare_url(basename)
    if (m = basename.to_s.match(/\A(.+)_(ssr|client|rsc)-(desktop|mobile)\z/))
      slug, variant, strategy = m[1], m[2], m[3]
      if variant == "rsc"
        left  = "#{slug}_ssr-#{strategy}"
        right = basename
      else
        left  = basename
        right = "#{slug}_rsc-#{strategy}"
      end
      "/lh-compare?left=#{left}&right=#{right}"
    else
      "/lighthouse-reports/index.html"
    end
  end

  # Convenience: given (slug, variant, strategy) directly.
  def lh_compare_url_for(slug, variant, strategy)
    lh_compare_url("#{slug}_#{variant}-#{strategy}")
  end
end

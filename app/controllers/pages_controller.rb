# frozen_string_literal: true

require "uri"

class PagesController < ApplicationController
  REPORTS_DIR = Rails.root.join("public/lighthouse-reports")
  REPORT_BASENAME_RE = /\A([a-z0-9_-]+)_(ssr|client|rsc)-(desktop|mobile)\z/.freeze

  def why_rsc; end
  def search_performance; end
  def measure; end

  def lh_compare
    @left  = params[:left].to_s
    @right = params[:right].to_s

    unless valid_report?(@left) && valid_report?(@right)
      redirect_to("/lighthouse-reports/index.html", allow_other_host: true) and return
    end

    @left_meta  = parse_report_basename(@left)
    @right_meta = parse_report_basename(@right)
    @left_data  = load_report(@left)
    @right_data = load_report(@right)

    # Default the slug + strategy display name from whichever side matches a known feature
    @feature_slug = @left_meta[:slug]
    @strategy     = @left_meta[:strategy]

    # Seed from the two reports already parsed in load_report above; only the
    # remaining variant (if any) still needs its JSON read.
    @app_urls = { @left => @left_data[:app_url], @right => @right_data[:app_url] }
    if @left_meta[:slug] == @right_meta[:slug] && @left_meta[:strategy] == @right_meta[:strategy]
      %w[ssr client rsc].each do |variant|
        basename = "#{@feature_slug}_#{variant}-#{@strategy}"
        next if @app_urls.key?(basename) || !valid_report?(basename)

        @app_urls[basename] = app_url_for_report(basename)
      end
    end
  end

  private

  def valid_report?(name)
    name.match?(REPORT_BASENAME_RE) && File.exist?(REPORTS_DIR.join("#{name}.json"))
  end

  def parse_report_basename(name)
    if (m = name.match(REPORT_BASENAME_RE))
      { slug: m[1], variant: m[2], strategy: m[3] }
    end
  end

  def load_report(name)
    j = JSON.parse(File.read(REPORTS_DIR.join("#{name}.json")))
    a = j["audits"]
    {
      score:     (j["categories"]["performance"]["score"] * 100).round,
      fcp:       a["first-contentful-paint"]["numericValue"].to_f,
      lcp:       a["largest-contentful-paint"]["numericValue"].to_f,
      tbt:       a["total-blocking-time"]["numericValue"].to_f,
      cls:       a["cumulative-layout-shift"]["numericValue"].to_f,
      si:        a["speed-index"]["numericValue"].to_f,
      bootup:    a["bootup-time"]["numericValue"].to_f,
      transfer:  a["total-byte-weight"]["numericValue"].to_f,
      app_url:   app_url_from_report(j),
    }
  end

  def app_url_for_report(name)
    app_url_from_report(JSON.parse(File.read(REPORTS_DIR.join("#{name}.json"))))
  end

  def app_url_from_report(report)
    raw_url = report["finalDisplayedUrl"].to_s
    raw_url = report["finalUrl"].to_s if raw_url.empty?
    return if raw_url.empty?

    uri = URI.parse(raw_url)
    path = uri.path.empty? ? "/" : uri.path
    uri.query ? "#{path}?#{uri.query}" : path
  rescue URI::InvalidURIError
    nil
  end
end

# frozen_string_literal: true

require 'open3'
require 'rails_helper'

# Keeps the Puppeteer gate's route inventory and the Ruby route contract identical.
#
# .verify-routes.js maintains its own list because it runs under Node, with no access
# to the Ruby contract. That list had drifted badly: before this spec existed it was
# missing every `-cached` variant, all six /css-demo routes, /media-gallery,
# /how-rsc-works and /ssr-rsc-playground — so the browser gate silently skipped
# roughly half the pages it was believed to cover.
#
# Comparing the two in both directions makes that drift impossible to reintroduce
# without a failing build. The shell-out only needs Node, not Puppeteer, so this runs
# in the Ruby-only specs.yml job.
RSpec.describe 'Browser route parity', type: :routing do
  let(:verifier_routes) do
    stdout, stderr, status = Open3.capture3('node', '.verify-routes.js', '--list-routes', chdir: Rails.root.to_s)
    raise "`node .verify-routes.js --list-routes` failed:\n#{stderr}" unless status.success?

    JSON.parse(stdout).sort
  end

  let(:contract_routes) { RouteContract.browser_route_paths }

  it 'opens every page the contract says should render' do
    missing = contract_routes - verifier_routes

    expect(missing).to be_empty, lambda {
      <<~MSG
        These pages are in the route contract but the Puppeteer gate never opens them:

        #{missing.map { |route| "  #{route}" }.join("\n")}

        Add them to DEFAULT_ROUTES in .verify-routes.js, or — if the page genuinely
        cannot be browser-verified — record it in RouteContract::FLAG_GATED with a reason.
      MSG
    }
  end

  it 'opens no page the contract does not know about' do
    unknown = verifier_routes - contract_routes

    expect(unknown).to be_empty, lambda {
      <<~MSG
        .verify-routes.js opens routes the contract does not list:

        #{unknown.map { |route| "  #{route}" }.join("\n")}

        Either the route was removed from config/routes.rb and DEFAULT_ROUTES still
        has it, or it is flag-gated and should not be in the browser list.
      MSG
    }
  end
end

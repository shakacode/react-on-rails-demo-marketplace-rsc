# frozen_string_literal: true

require 'rails_helper'

# The guard that keeps the rest of this suite honest (issue #142).
#
# Every other spec here enumerates routes by hand, which is exactly how the suite
# fell ~20 routes behind config/routes.rb over three months. This compares the
# contract against the real router in both directions, so neither side can drift
# silently.
RSpec.describe 'Public route coverage', type: :routing do
  let(:declared) { RouteContract.declared_specs }
  let(:routed) { RouteContract.routed_specs }

  it 'has a case for every app-owned public GET route' do
    missing = routed - declared

    expect(missing).to be_empty, lambda {
      <<~MSG
        These app-owned public GET routes have no case in the route contract:

        #{missing.map { |spec| "  #{spec}" }.join("\n")}

        Add each one to the right bucket in spec/support/route_contract.rb:

          RENDERED_PAGES            renderer-free page; also gets a 200 + layout request spec
          RENDERER_BACKED           rendered with prerender: true, so dispatch-only here
          API_GET_ENDPOINTS         JSON endpoint; also gets a request spec
          *_PERMANENT_REDIRECTS     308 redirect, keyed by path => target
          CONDITIONAL_REDIRECT_PAGES  page that redirects when params are missing/invalid
          EXCLUSIONS                not owned by this app — requires a reason
      MSG
    }
  end

  it 'has no contract entry for a route that no longer exists' do
    stale = declared - routed

    expect(stale).to be_empty, lambda {
      <<~MSG
        The route contract still lists routes the router does not know about:

        #{stale.map { |spec| "  #{spec}" }.join("\n")}

        Either the route was renamed or removed in config/routes.rb and the contract
        entry in spec/support/route_contract.rb needs the same change, or the path
        spec is misspelled (dynamic segments must be written as ':id', not a value).
      MSG
    }
  end

  it 'covers every dynamic segment with an example value' do
    segments = routed.flat_map { |spec| spec.scan(/:(\w+)/).flatten }.uniq.map(&:to_sym)
    unmapped = segments - RouteContract::DYNAMIC_SEGMENT_EXAMPLES.keys

    expect(unmapped).to be_empty, lambda {
      <<~MSG
        These dynamic route segments have no example value: #{unmapped.join(', ')}

        Add each to RouteContract::DYNAMIC_SEGMENT_EXAMPLES so its routes can be
        asserted with a deterministic path.
      MSG
    }
  end
end

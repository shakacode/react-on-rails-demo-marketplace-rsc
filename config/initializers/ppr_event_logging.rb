# frozen_string_literal: true

# Log the PPR instrumentation events react_on_rails_pro emits (cache writes, refused
# writes, invalid-entry evictions, static-shell serves, resume degradations) so the
# cache hit/miss behavior of /product/ppr is observable in development without a
# metrics backend. Event catalog: react_on_rails_pro/lib/react_on_rails_pro/ppr.rb.
if Rails.env.development?
  ActiveSupport::Notifications.subscribe(/^ppr\..*\.react_on_rails_pro$/) do |name, _start, _finish, _id, payload|
    Rails.logger.info("[PPR event] #{name.sub('.react_on_rails_pro', '')} #{payload.inspect}")
  end
end

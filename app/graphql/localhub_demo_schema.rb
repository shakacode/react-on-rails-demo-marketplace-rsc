# frozen_string_literal: true

class LocalhubDemoSchema < GraphQL::Schema
  query Types::QueryType

  # Prevent abuse from the node-renderer or untrusted clients.
  max_complexity 200
  max_depth 10

  # Disable introspection in production (enable with GRAPHQL_INTROSPECTION=1).
  disable_introspection_entry_points unless ENV["GRAPHQL_INTROSPECTION"] == "1" || !Rails.env.production?
end

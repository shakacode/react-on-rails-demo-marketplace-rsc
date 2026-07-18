# frozen_string_literal: true

require 'json'

# Loads the canonical route inventory and compares it with the Rails route set.
module PublicRouteContract
  CONTRACT_PATH = Rails.root.join('config/public_routes.json')
  FORMAT_SUFFIX = '(.:format)'

  module_function

  def data
    @data ||= JSON.parse(CONTRACT_PATH.read)
  end

  def routes
    data.fetch('routes')
  end

  def exclusions
    data.fetch('exclusions')
  end

  def route_patterns
    Rails.application.routes.routes.filter_map do |route|
      next unless route.verb.to_s.split('|').include?('GET')

      normalize_pattern(route.path.spec.to_s)
    end.uniq
  end

  def uncovered_get_route_patterns(exercised_patterns)
    route_patterns.reject do |pattern|
      exercised_patterns.include?(pattern) || excluded?(pattern)
    end
  end

  def normalize_pattern(pattern)
    pattern.delete_suffix(FORMAT_SUFFIX)
  end

  def excluded?(pattern)
    exclusions.any? do |exclusion|
      case exclusion.fetch('match')
      when 'exact'
        exclusion.fetch('paths').include?(pattern)
      when 'prefix'
        pattern.start_with?(exclusion.fetch('value'))
      else
        raise ArgumentError, "Unknown public-route exclusion matcher: #{exclusion.fetch('match').inspect}"
      end
    end
  end
end

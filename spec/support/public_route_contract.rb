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
    application_get_routes.map { |route| normalize_pattern(route.path.spec.to_s) }.uniq
  end

  def controller_classes
    contract_patterns = routes.map { |route_case| route_case.fetch('path') }

    application_get_routes.filter_map do |route|
      next unless contract_patterns.include?(normalize_pattern(route.path.spec.to_s))

      controller_class_for(route)
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

  def application_get_routes
    Rails.application.routes.routes.select do |route|
      route.verb.to_s.split('|').include?('GET')
    end
  end

  def controller_class_for(route)
    controller_path = route.defaults[:controller]
    "#{controller_path.camelize}Controller".constantize if controller_path
  end
end

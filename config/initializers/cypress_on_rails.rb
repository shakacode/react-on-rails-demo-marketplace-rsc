# frozen_string_literal: true

# The E2E command endpoint executes Ruby files with the Rails process's
# privileges. Keep it explicitly enabled, limited to the test environment,
# and authorize only the socket peer recorded by Rack.
module E2ERailsBridge
  ALLOWED_COMMANDS = ['clean', 'scenarios/product_search'].freeze
  COMMAND_PATH = '/__e2e__/command'
  LOOPBACK_ADDRESSES = ['127.0.0.1', '::1'].freeze
  PRIVATE_COMMANDS_ENV = 'E2E_RAILS_COMMANDS'
  PRIVATE_TOKEN_ENV = 'E2E_RAILS_TOKEN'
  TOKEN_MINIMUM_BYTES = 64

  module_function

  def enabled?(
    environment: Rails.env,
    opt_in: ENV.fetch(PRIVATE_COMMANDS_ENV, nil),
    token: ENV.fetch(PRIVATE_TOKEN_ENV, nil)
  )
    environment.to_s == 'test' &&
      opt_in == '1' &&
      token&.bytesize.to_i >= TOKEN_MINIMUM_BYTES
  end

  def authorize(request, expected_token: ENV.fetch(PRIVATE_TOKEN_ENV, nil))
    return forbidden unless trusted_source?(request, expected_token)
    return method_not_allowed unless request.post?

    forbidden unless allowed_commands?(request)
  rescue JSON::ParserError, TypeError
    [400, { 'content-type' => 'text/plain; charset=utf-8' }, ['Bad Request']]
  end

  def trusted_source?(request, expected_token)
    LOOPBACK_ADDRESSES.include?(request.get_header('REMOTE_ADDR')) &&
      request.path == COMMAND_PATH &&
      request.get_header('HTTP_ORIGIN').blank? &&
      request.media_type == 'application/json' &&
      valid_token?(request.get_header('HTTP_X_E2E_RAILS_TOKEN'), expected_token)
  end

  def valid_token?(provided_token, expected_token)
    return false unless provided_token.is_a?(String) && expected_token.is_a?(String)
    return false unless provided_token.bytesize == expected_token.bytesize
    return false if expected_token.bytesize < TOKEN_MINIMUM_BYTES

    ActiveSupport::SecurityUtils.secure_compare(provided_token, expected_token)
  end

  def allowed_commands?(request)
    command_names = requested_command_names(request)
    command_names.any? && command_names.all? { |name| ALLOWED_COMMANDS.include?(name) }
  end

  def requested_command_names(request)
    request.body.rewind
    payload = JSON.parse(request.body.read)
    commands = payload.is_a?(Array) ? payload : [payload]

    commands.map do |command|
      raise TypeError unless command.is_a?(Hash) && command['name'].is_a?(String)

      command['name']
    end
  ensure
    request.body.rewind
  end

  def forbidden
    [403, { 'content-type' => 'text/plain; charset=utf-8' }, ['Forbidden']]
  end

  def method_not_allowed
    [405, { 'content-type' => 'text/plain; charset=utf-8' }, ['Method Not Allowed']]
  end
end

if defined?(CypressOnRails)
  CypressOnRails.configure do |config|
    config.install_folder = Rails.root.join('e2e').to_s
    # The gem's automatic path also installs an unauthenticated state-reset
    # middleware. Keep it disabled and mount only the guarded command endpoint.
    config.use_middleware = false
    config.before_request = E2ERailsBridge.method(:authorize)
    config.server_host = '127.0.0.1'
    config.server_port = 5017
    config.server_readiness_path = '/up'
    config.logger = Rails.logger
  end

  if E2ERailsBridge.enabled?
    require 'cypress_on_rails/middleware'

    Rails.application.config.middleware.use CypressOnRails::Middleware
  end
end

# frozen_string_literal: true

# POST-only GraphQL endpoint for the Apollo Client RSC demo (issue #255).
#
# The node-renderer's HttpLink POSTs queries here during RSC rendering. Since
# those requests originate from the renderer process (not a browser with a
# session cookie), CSRF verification is skipped via null_session. Production
# deployments should add authentication/authorization as needed.
class GraphqlController < ApplicationController
  # Renderer requests don't carry a Rails CSRF token.
  protect_from_forgery with: :null_session

  def execute
    result = LocalhubDemoSchema.execute(
      params[:query],
      variables: prepare_variables(params[:variables]),
      context: {},
      operation_name: params[:operationName]
    )
    render json: result
  rescue StandardError => e
    raise e unless Rails.env.development?

    handle_error_in_development(e)
  end

  private

  # Handle variables in form data, JSON body, or blank.
  def prepare_variables(variables_param)
    case variables_param
    when String
      variables_param.present? ? JSON.parse(variables_param) : {}
    when Hash
      variables_param
    when ActionController::Parameters
      variables_param.to_unsafe_h
    when nil
      {}
    else
      raise ArgumentError, "Unexpected parameter: #{variables_param}"
    end
  end

  def handle_error_in_development(error)
    logger.error error.message
    logger.error error.backtrace.join("\n")
    render json: { errors: [{ message: error.message, backtrace: error.backtrace.first(5) }], data: {} },
           status: :internal_server_error
  end
end

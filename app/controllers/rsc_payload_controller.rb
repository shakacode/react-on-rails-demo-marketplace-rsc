# frozen_string_literal: true

# App-level RSC payload controller (issue #245 hardening). Wired via
# `rsc_payload_route(controller: "rsc_payload")` in config/routes.rb.
#
# Why a controller and not just the template override: `?props=` is
# browser-supplied, and a bad product id must become a real 404. The template
# cannot do that — by the time it runs, the streamed response has started, and
# an exception raised inside a rendered view arrives wrapped in
# ActionView::Template::Error (status 500). A before_action runs before any
# NDJSON chunk is emitted, so the status is still ours to set.
class RscPayloadController < ReactOnRailsPro::RscPayloadController
  before_action :ensure_product_payload_target_exists

  private

  # Only the product id is read from the untrusted props JSON; the template
  # override rebuilds the full initial props server-side from the found record
  # (ProductRscProps.initial_props), so nothing else the browser sent is used.
  def ensure_product_payload_target_exists
    return unless params[:component_name] == 'ProductPageRSC'

    props = parsed_untrusted_props
    # Malformed JSON keeps the gem's own contract: rsc_payload renders 400.
    return if props == :invalid_json

    product_id = props.is_a?(Hash) ? props.dig('product', 'id') : nil
    head :not_found unless Product.exists?(id: product_id)
  end

  def parsed_untrusted_props
    JSON.parse(params[:props].presence || '{}')
  rescue JSON::ParserError
    :invalid_json
  end
end

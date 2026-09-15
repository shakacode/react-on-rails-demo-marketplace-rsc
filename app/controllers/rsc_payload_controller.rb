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
  # Component-agnostic: bracket-notation query params (?props[foo]=bar) reach
  # Rails as a Hash, not a JSON string, and the gem's JSON.parse would raise an
  # unrescued TypeError (500) for ANY component. 400 for all of them.
  before_action :reject_non_string_props
  before_action :ensure_product_payload_target_exists

  private

  def reject_non_string_props
    head :bad_request unless params[:props].blank? || params[:props].is_a?(String)
  end

  # Only the product id is read from the untrusted props JSON; the template
  # override rebuilds the full initial props server-side from the found record
  # (@payload_product / ProductRscProps.initial_props), so nothing else the
  # browser sent is used.
  def ensure_product_payload_target_exists
    return unless params[:component_name] == 'ProductPageRSC'

    props = parsed_untrusted_props
    # Malformed JSON string keeps the gem's own contract: rsc_payload renders 400.
    return if props == :invalid_json

    # Found here once; the template renders from this record instead of
    # re-parsing/re-querying the same untrusted input.
    @payload_product = Product.find_by(id: scalar_product_id(props))
    head :not_found unless @payload_product
  end

  def parsed_untrusted_props
    raw = params[:props]
    return {} if raw.blank?

    JSON.parse(raw)
  rescue JSON::ParserError
    :invalid_json
  end

  # JSON can put any value at product.id (hash, array, bool); ActiveRecord
  # treats a Hash id as a nested condition and errors. Accept only scalars.
  def scalar_product_id(props)
    id = props.is_a?(Hash) ? props.dig('product', 'id') : nil
    id.is_a?(Integer) || id.is_a?(String) ? id : nil
  end
end

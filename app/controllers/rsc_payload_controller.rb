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

  # Components whose payload branch renders from a Product record. Both read
  # ONLY the product id out of the untrusted props JSON; the template override
  # rebuilds the full initial props server-side from the found record
  # (@payload_product / ProductRscProps), so nothing else the browser sent is
  # used. ProductReviewsSectionRSC is the C5 nested section route (issue #245).
  PRODUCT_PAYLOAD_COMPONENTS = %w[ProductPageRSC ProductReviewsSectionRSC].freeze

  private

  def reject_non_string_props
    head :bad_request unless params[:props].blank? || params[:props].is_a?(String)
  end

  def ensure_product_payload_target_exists
    return unless PRODUCT_PAYLOAD_COMPONENTS.include?(params[:component_name])

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

  # JSON can put any value at the id position (hash, array, bool); ActiveRecord
  # treats a Hash id as a nested condition and errors. Accept only scalars.
  # Prop shapes differ per component: the whole page mounts with the full
  # product object ({product: {id: ...}}), the nested section route mounts
  # with {product_id: ...} (see ReviewsSectionRoute).
  def scalar_product_id(props)
    return nil unless props.is_a?(Hash)

    id = case params[:component_name]
         when 'ProductPageRSC'
           # `product` itself is untrusted and may be any JSON value, and
           # Hash#dig raises TypeError on a non-dig-able intermediate.
           product = props['product']
           product.is_a?(Hash) ? product['id'] : nil
         when 'ProductReviewsSectionRSC'
           props['product_id']
         end
    id.is_a?(Integer) || id.is_a?(String) ? id : nil
  end
end

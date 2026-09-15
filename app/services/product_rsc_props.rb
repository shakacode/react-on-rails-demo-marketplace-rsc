# frozen_string_literal: true

# Single source of truth for the async-props emit block of the ProductPageRSC
# page (issue #245 — read-your-writes spike). Both render doors call it:
#
#   * door #1 — app/views/products/show_rsc.html.erb, the initial streamed page
#   * door #2 — app/views/react_on_rails_pro/rsc_payload.text.erb, the payload
#     endpoint RSCRoute.refetch() fetches after a mutation
#
# Extracting the block keeps the doors from drifting apart. Row shapes come
# from the shared ProductSerialization concern (PR #242 consolidates
# serializers there — do not invent new ones).
class ProductRscProps
  include ProductSerialization

  def self.emit_all(product, emit)
    new.emit_all(product, emit)
  end

  # Trusted initial props for the refetch door. Door #1's controller builds the
  # same shape (ProductsController#show_rsc: serialize_product minus the
  # async-streamed fields), so door #2 rebuilds it server-side from the found
  # record instead of trusting the browser's copy in ?props= — a hand-crafted
  # minimal payload otherwise crashes components that assume the full shape
  # (e.g. buildProductSpecMarkdown needs sku; see docs/rsc-read-your-writes.md C4).
  def self.initial_props(product)
    new.initial_props(product)
  end

  def initial_props(product)
    { product: serialize_product(product).except(:description, :features, :specs) }
  end

  # Emission order mirrors the original view block: product_details first
  # (below-the-fold content, emitted immediately so the initial stream
  # prioritizes the hero section for LCP), then review stats (rating
  # distribution aggregation), reviews (complex sort query), and related
  # products (recommendation query).
  def emit_all(product, emit)
    emit.call('product_details', product_details(product))
    emit.call('review_stats', product.review_stats)
    emit.call('reviews', reviews(product))
    emit.call('related_products', related_products(product))
  end

  private

  def product_details(product)
    {
      description: product.description,
      features: product.features,
      specs: product.specs
    }
  end

  def reviews(product)
    { reviews: product.top_reviews(5).map { |r| serialize_review(r) } }
  end

  def related_products(product)
    { products: product.related_products(4).map { |p| serialize_product_card(p) } }
  end
end

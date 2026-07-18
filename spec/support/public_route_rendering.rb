# frozen_string_literal: true

# Request specs exercise Rails routing, controller actions, and ERB templates.
# Existing build and browser-smoke gates cover the external renderer and compiled
# asset contents, so this focused contract replaces only those process boundaries.
module PublicRouteRenderingStub
  COMPONENT_HTML = '<div data-route-contract-component="true"></div>'.html_safe
  NO_OP_EMITTER = ->(*, **) {}

  def react_component(*, **, &)
    COMPONENT_HTML
  end

  def react_component_hash(*, **, &)
    {
      'componentHtml' => COMPONENT_HTML,
      'linkTags' => '',
      'scriptTags' => '',
      'styleTags' => ''
    }
  end

  def stream_react_component(*, **, &)
    COMPONENT_HTML
  end

  def stream_react_component_with_async_props(*, **, &async_props_block)
    async_props_block&.call(NO_OP_EMITTER)
    COMPONENT_HTML
  end

  def cached_react_component(*, **, &props_block)
    props_block&.call
    COMPONENT_HTML
  end

  def cached_stream_react_component(*, **, &props_block)
    props_block&.call
    COMPONENT_HTML
  end

  def stylesheet_pack_tag(*, **)
    ''
  end

  def javascript_pack_tag(*, **)
    ''
  end

  def append_stylesheet_pack_tag(*, **)
    nil
  end

  VIEW_HELPER_METHODS = instance_methods(false).freeze

  def self.implementation_for(method_name)
    stub_method = instance_method(method_name)

    lambda do |view_context, *args, **kwargs, &block|
      stub_method.bind_call(view_context, *args, **kwargs, &block)
    end
  end
end

# Replaces the external streaming renderer with ordinary template rendering.
module PublicRouteControllerRenderingStub
  def stream_view_containing_react_components(template:, **)
    render(template:)
  end

  def self.implementation
    stub_method = instance_method(:stream_view_containing_react_components)

    lambda do |controller, *args, **kwargs, &block|
      stub_method.bind_call(controller, *args, **kwargs, &block)
    end
  end
end

PUBLIC_ROUTE_CONTROLLERS = [
  ApplicationController,
  BlogController,
  CssDemoController,
  HomeController,
  MediaGalleryController,
  PagesController,
  ProductSearchController,
  ProductsController,
  RestaurantsController
].freeze

RSpec.configure do |config|
  config.before(:each, public_route_contract: true) do
    allow(ReactOnRailsPro::Utils).to receive(:bundle_hash).and_return('route-contract-server-bundle')
    allow(ReactOnRailsPro::Utils).to receive(:rsc_bundle_hash).and_return('route-contract-rsc-bundle')

    streaming_controllers = PUBLIC_ROUTE_CONTROLLERS.select do |controller|
      controller.method_defined?(:stream_view_containing_react_components)
    end

    streaming_controllers.each do |controller|
      allow_any_instance_of(controller)
        .to receive(
          :stream_view_containing_react_components,
          &PublicRouteControllerRenderingStub.implementation
        )
    end

    PUBLIC_ROUTE_CONTROLLERS.map(&:view_context_class).uniq.each do |view_context_class|
      PublicRouteRenderingStub::VIEW_HELPER_METHODS.each do |method_name|
        allow_any_instance_of(view_context_class)
          .to receive(method_name, &PublicRouteRenderingStub.implementation_for(method_name))
      end
    end
  end
end

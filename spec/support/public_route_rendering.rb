# frozen_string_literal: true

# Request specs exercise Rails routing, controller actions, and ERB templates.
# Existing build and browser-smoke gates cover the external renderer and compiled
# asset contents, so this focused contract replaces only those process boundaries.
module PublicRouteRenderingStub
  COMPONENT_HTML = '<div data-route-contract-component="true"></div>'.html_safe

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

  def stream_react_component_with_async_props(*, **, &)
    COMPONENT_HTML
  end

  def cached_react_component(*, **, &)
    COMPONENT_HTML
  end

  def cached_stream_react_component(*, **, &)
    COMPONENT_HTML
  end

  def cached_stream_react_component_with_async_props(*, **, &)
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
end

# Replaces the external streaming renderer with ordinary template rendering.
module PublicRouteControllerRenderingStub
  def stream_view_containing_react_components(template:, **)
    render(template:)
  end
end

[
  ApplicationController,
  BlogController,
  CssDemoController,
  HomeController,
  MediaGalleryController,
  PagesController,
  ProductSearchController,
  ProductsController,
  RestaurantsController
].each do |controller|
  controller.prepend(PublicRouteControllerRenderingStub)
  controller.view_context_class.prepend(PublicRouteRenderingStub)
end

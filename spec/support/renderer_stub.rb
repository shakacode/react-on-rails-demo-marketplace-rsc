# frozen_string_literal: true

# Lets request specs exercise the feature pages without the external Node renderer.
#
# Every `*/ssr`, `*/rsc`, `*-cached`, `/css-demo/**` and `/media-gallery` page renders
# React server-side through the Pro renderer, which needs built bundles and a running
# renderer process. Replacing the handful of helpers at that process boundary — and
# nothing else — lets a request spec run the real controller, the real data assembly
# and the real ERB template, and assert the page renders. Bundle contents and
# hydration stay with the Puppeteer gate (.verify-routes.js / browser-smoke.yml),
# which builds for real.
#
# Adapted from the approach in PR #147.
#
# The stubs are opt-in via the `renderer_stub: true` metadata tag and are scoped to
# the controllers in RouteContract.controller_classes, so an untagged example still
# sees the genuine helpers. spec/requests/feature_pages_spec.rb asserts that isolation.
module RendererStub
  COMPONENT_HTML = '<div data-renderer-stub="true"></div>'.html_safe

  # `stream_react_component_with_async_props` yields an emitter. In push mode the block
  # calls `emit.call(name, value)`; in pull mode (`/product/rsc-pull`) it loops on
  # `emit.pull_requests.dequeue` until that returns nil. Draining immediately keeps the
  # page rendering without inventing prop names the view's `case` does not handle — the
  # pull loop body itself is covered by the browser gate.
  class PullRequests
    def dequeue
      nil
    end
  end

  # Stands in for the async-props emitter yielded to the view's block.
  class Emitter
    def call(*, **); end

    def pull_requests
      @pull_requests ||= PullRequests.new
    end
  end

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

  # Runs the block so the controller's data assembly is still exercised.
  def stream_react_component_with_async_props(*, **, &async_props_block)
    async_props_block&.call(Emitter.new)
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

  # PPR renders a cached shell; the block supplies the shell's props.
  def ppr_react_component(*, **, &props_block)
    props_block&.call
    COMPONENT_HTML
  end

  VIEW_HELPER_METHODS = instance_methods(false).freeze

  def self.implementation_for(method_name)
    stub_method = instance_method(method_name)

    lambda do |view_context, *args, **kwargs, &block|
      stub_method.bind_call(view_context, *args, **kwargs, &block)
    end
  end
end

# Turns the streaming response into ordinary template rendering.
module RendererStubControllerRendering
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

RSpec.configure do |config|
  config.before(:each, renderer_stub: true) do
    # Cache-key computation for the cached_* helpers reaches for the real bundle
    # digests, which only exist after a production build.
    allow(ReactOnRailsPro::Utils).to receive(:bundle_hash).and_return('renderer-stub-server-bundle')
    allow(ReactOnRailsPro::Utils).to receive(:rsc_bundle_hash).and_return('renderer-stub-rsc-bundle')

    controllers = RouteContract.controller_classes

    controllers.select { |c| c.method_defined?(:stream_view_containing_react_components) }
               .each do |controller|
      allow_any_instance_of(controller)
        .to receive(:stream_view_containing_react_components, &RendererStubControllerRendering.implementation)
    end

    controllers.map(&:view_context_class).uniq.each do |view_context_class|
      RendererStub::VIEW_HELPER_METHODS.each do |method_name|
        # `verify_partial_doubles` rejects stubbing a method the class does not
        # define, and not every view context gets every Pro helper — only
        # ProductsController's sees `ppr_react_component`, for instance.
        next unless view_context_class.method_defined?(method_name)

        allow_any_instance_of(view_context_class)
          .to receive(method_name, &RendererStub.implementation_for(method_name))
      end
    end
  end
end

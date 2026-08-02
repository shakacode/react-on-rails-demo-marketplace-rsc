# frozen_string_literal: true

module PPRPatches
  # Adds Partial Prerendering JavaScript generation to the Pro renderer.
  module ServerRenderingJsCodePatch
    RENDER_TEMPLATE = <<-'JS'
      (function(componentName = %s, props = undefined) {
        var railsContext = %s;
        %s
        %s
        %s
        %s
        %s
        var usedProps = typeof props === 'undefined' ? %s : props;
        %s
        return ReactOnRails[%s]({
          name: componentName,
          domNodeId: %s,
          props: usedProps,
          trace: %s,
          railsContext: railsContext,
          throwJsErrors: %s,
          renderingReturnsPromises: %s,
          generateRSCPayload: typeof generateRSCPayload !== 'undefined' ? generateRSCPayload : undefined,
        });
      })()
    JS

    def render(props_string, rails_context, redux_stores, react_component_name, render_options)
      template_values = render_template_values(
        props_string, rails_context, redux_stores, react_component_name, render_options
      )
      format(RENDER_TEMPLATE, *template_values)
    end

    def render_template_values(props_string, rails_context, redux_stores, react_component_name, render_options)
      [react_component_name.to_json, rails_context] +
        render_mode_template_values(render_options) +
        render_script_template_values(render_options, redux_stores, props_string) +
        render_configuration_template_values
    end

    def render_mode_template_values(render_options)
      [
        rsc_context_params_js(render_options),
        ppr_resume_context_params_js(render_options)
      ]
    end

    def render_script_template_values(render_options, redux_stores, props_string)
      [
        generate_rsc_payload_js_function(render_options), ssr_pre_hook_js, redux_stores, props_string,
        async_props_setup_js(render_options), resolve_render_function_name(render_options),
        render_options.dom_id.to_json, render_options.trace
      ]
    end

    def render_configuration_template_values
      configuration = ReactOnRailsPro.configuration
      [configuration.throw_js_errors, configuration.rendering_returns_promises]
    end

    def resolve_render_function_name(render_options)
      return ppr_render_function_name(render_options) if render_options.ppr_prerender? || render_options.ppr_resume?
      return rsc_streaming_render_function_name if rsc_streaming?(render_options)

      "'serverRenderReactComponent'"
    end

    def ppr_render_function_name(render_options)
      function_name = if render_options.ppr_prerender?
                        'pprPrerenderServerRenderedReactComponent'
                      else
                        'pprResumeServerRenderedReactComponent'
                      end
      return "'#{function_name}'" unless ReactOnRailsPro.configuration.enable_rsc_support

      "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : '#{function_name}'"
    end

    def rsc_streaming?(render_options)
      ReactOnRailsPro.configuration.enable_rsc_support && render_options.streaming?
    end

    def rsc_streaming_render_function_name
      "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : 'streamServerRenderedReactComponent'"
    end

    def rsc_context_params_js(render_options)
      return '' unless ReactOnRailsPro.configuration.enable_rsc_support && render_options.streaming?

      config = ReactOnRailsPro.configuration
      <<-JS
        railsContext.reactClientManifestFileName = #{config.react_client_manifest_file.to_json};
        railsContext.reactServerClientManifestFileName = #{config.react_server_client_manifest_file.to_json};
      JS
    end

    def ppr_resume_context_params_js(render_options)
      return '' unless render_options.ppr_resume?

      postponed_state = render_options.internal_option(:ppr_postponed_state)
      <<-JS
        railsContext.pprPostponedState = #{postponed_state.to_json};
      JS
    end
  end
end

ReactOnRailsPro::ServerRenderingJsCode.singleton_class.prepend(PPRPatches::ServerRenderingJsCodePatch)

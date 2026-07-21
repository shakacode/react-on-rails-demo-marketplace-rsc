# frozen_string_literal: true

module PPRPatches
  module ServerRenderingJsCodePatch
    def render(props_string, rails_context, redux_stores, react_component_name, render_options)
      render_function_name = resolve_render_function_name(render_options)
      rsc_params = rsc_context_params_js(render_options)
      ppr_resume_params = ppr_resume_context_params_js(render_options)

      <<-JS
      (function(componentName = #{react_component_name.to_json}, props = undefined) {
        var railsContext = #{rails_context};
        #{rsc_params}
        #{ppr_resume_params}
        #{generate_rsc_payload_js_function(render_options)}
        #{ssr_pre_hook_js}
        #{redux_stores}
        var usedProps = typeof props === 'undefined' ? #{props_string} : props;
        #{async_props_setup_js(render_options)}
        return ReactOnRails[#{render_function_name}]({
          name: componentName,
          domNodeId: #{render_options.dom_id.to_json},
          props: usedProps,
          trace: #{render_options.trace},
          railsContext: railsContext,
          throwJsErrors: #{ReactOnRailsPro.configuration.throw_js_errors},
          renderingReturnsPromises: #{ReactOnRailsPro.configuration.rendering_returns_promises},
          generateRSCPayload: typeof generateRSCPayload !== 'undefined' ? generateRSCPayload : undefined,
        });
      })()
      JS
    end

    def resolve_render_function_name(render_options)
      if render_options.ppr_prerender?
        if ReactOnRailsPro.configuration.enable_rsc_support
          "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : 'pprPrerenderServerRenderedReactComponent'"
        else
          "'pprPrerenderServerRenderedReactComponent'"
        end
      elsif render_options.ppr_resume?
        if ReactOnRailsPro.configuration.enable_rsc_support
          "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : 'pprResumeServerRenderedReactComponent'"
        else
          "'pprResumeServerRenderedReactComponent'"
        end
      elsif ReactOnRailsPro.configuration.enable_rsc_support && render_options.streaming?
        "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : 'streamServerRenderedReactComponent'"
      else
        "'serverRenderReactComponent'"
      end
    end

    def rsc_context_params_js(render_options)
      return "" unless ReactOnRailsPro.configuration.enable_rsc_support && render_options.streaming?

      config = ReactOnRailsPro.configuration
      <<-JS
        railsContext.reactClientManifestFileName = #{config.react_client_manifest_file.to_json};
        railsContext.reactServerClientManifestFileName = #{config.react_server_client_manifest_file.to_json};
      JS
    end

    def ppr_resume_context_params_js(render_options)
      return "" unless render_options.ppr_resume?

      postponed_state = render_options.internal_option(:ppr_postponed_state)
      <<-JS
        railsContext.pprPostponedState = #{postponed_state.to_json};
      JS
    end
  end
end

ReactOnRailsPro::ServerRenderingJsCode.singleton_class.prepend(PPRPatches::ServerRenderingJsCodePatch)

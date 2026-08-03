# frozen_string_literal: true

module PPRPatches
  # Overrides ServerRenderingJsCode to inject PPR-specific render function dispatch
  # and context parameters (RSC manifests, postponed state) into the server-side JS.
  module ServerRenderingJsCodePatch
    def render(props_string, rails_context, redux_stores, react_component_name, render_options)
      fn_name = resolve_render_function_name(render_options)
      preamble = render_preamble_js(render_options, redux_stores)
      invocation = render_invocation_js(fn_name, render_options)

      <<~JS
        (function(componentName = #{react_component_name.to_json}, props = undefined) {
          var railsContext = #{rails_context};
          #{preamble}
          var usedProps = typeof props === 'undefined' ? #{props_string} : props;
          #{async_props_setup_js(render_options)}
          return #{invocation};
        })()
      JS
    end

    private

    def render_preamble_js(render_options, redux_stores)
      [
        rsc_context_params_js(render_options),
        ppr_resume_context_params_js(render_options),
        generate_rsc_payload_js_function(render_options),
        ssr_pre_hook_js,
        redux_stores
      ].join("\n")
    end

    def render_invocation_js(fn_name, opts)
      cfg = ReactOnRailsPro.configuration
      props_json = render_invocation_props_js(opts, cfg)
      "ReactOnRails[#{fn_name}]({#{props_json}})"
    end

    def render_invocation_props_js(opts, cfg)
      <<~JS.chomp

        name: componentName,
        domNodeId: #{opts.dom_id.to_json},
        props: usedProps,
        trace: #{opts.trace},
        railsContext: railsContext,
        throwJsErrors: #{cfg.throw_js_errors},
        renderingReturnsPromises: #{cfg.rendering_returns_promises},
        generateRSCPayload: typeof generateRSCPayload !== 'undefined' ? generateRSCPayload : undefined,

      JS
    end

    def resolve_render_function_name(render_options)
      base = base_render_function(render_options)

      if ReactOnRailsPro.configuration.enable_rsc_support && render_options.streaming?
        "ReactOnRails.isRSCBundle ? 'serverRenderRSCReactComponent' : '#{base}'"
      else
        "'#{base}'"
      end
    end

    def base_render_function(render_options)
      if render_options.ppr_prerender? then 'pprPrerenderServerRenderedReactComponent'
      elsif render_options.ppr_resume? then 'pprResumeServerRenderedReactComponent'
      elsif render_options.streaming? then 'streamServerRenderedReactComponent'
      else 'serverRenderReactComponent'
      end
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

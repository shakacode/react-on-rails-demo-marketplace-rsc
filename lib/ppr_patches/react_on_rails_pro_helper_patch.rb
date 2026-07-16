# frozen_string_literal: true

module PPRPatches
  module ReactOnRailsProHelperPatch
    PPR_POSTPONED_STATE_DELIMITER = "<!--PPR_POSTPONED_STATE-->"

    def ppr_react_component(component_name, raw_options = {}, &block)
      ReactOnRailsPro::Utils.with_trace(component_name) do
        check_caching_options!(raw_options, block)
        render_options = options_with_auto_load_bundle(raw_options)

        cache_key = ppr_cache_key(component_name, render_options)
        raw_cache_options = render_options[:cache_options] || {}
        cache_write_options = ReactOnRailsPro::Cache.cache_write_options(raw_cache_options)

        cached_entry = Rails.cache.read(cache_key, cache_write_options)

        if cached_entry.is_a?(Hash) && cached_entry[:shell_html] && cached_entry[:postponed_state]
          ppr_cache_hit(component_name, render_options, cached_entry, cache_write_options, &block)
        else
          ppr_cache_miss(component_name, render_options, cache_key, cache_write_options, &block)
        end
      end
    end

    private

    def ppr_cache_key(component_name, render_options)
      raw_cache_key = render_options[:cache_key]
      cache_key_value = raw_cache_key.respond_to?(:call) ? raw_cache_key.call : raw_cache_key

      ReactOnRailsPro::Cache.react_component_cache_key(
        component_name,
        render_options.merge(
          cache_key: ["ppr_react_component", cache_key_value],
          prerender: true
        )
      )
    end

    def ppr_cache_hit(component_name, render_options, cached_entry, _cache_write_options, &block)
      load_pack_for_cached_react_component(component_name, render_options)

      shell_html = cached_entry[:shell_html]
      postponed_state = cached_entry[:postponed_state]

      props = block ? yield : {}
      options = render_options.merge(props:, prerender: true, skip_prerender_cache: true)

      on_complete = options.delete(:on_complete)
      first_resume_chunk = consumer_stream_async(on_complete:) do
        ppr_resume_stream(component_name, options, postponed_state)
      end
      @main_output_queue.enqueue(first_resume_chunk) if first_resume_chunk.present?

      shell_html.html_safe
    end

    def ppr_cache_miss(component_name, render_options, cache_key, cache_write_options)
      props = yield
      options = render_options.merge(
        props:,
        prerender: true,
        skip_prerender_cache: true
      )

      shell_html, postponed_state = ppr_prerender(component_name, options)

      normalized_cache_tags = ReactOnRailsPro::Cache.normalize_tags(render_options[:cache_tags])
      Rails.cache.write(
        cache_key,
        { shell_html:, postponed_state: },
        cache_write_options
      )
      ReactOnRailsPro::Cache.register_normalized_tags(normalized_cache_tags, cache_key, cache_write_options)

      on_complete = options.delete(:on_complete)
      first_resume_chunk = consumer_stream_async(on_complete:) do
        ppr_resume_stream(component_name, options, postponed_state)
      end
      @main_output_queue.enqueue(first_resume_chunk) if first_resume_chunk.present?

      shell_html.html_safe
    end

    def ppr_prerender(component_name, options)
      prerender_options = options.merge(render_mode: :ppr_prerender)
      result = internal_react_component(component_name, prerender_options)

      buffer = +""
      result[:result].each_chunk do |chunk_json|
        buffer << (chunk_json["html"] || "")
      end

      ppr_parse_prerender_response(buffer)
    end

    def ppr_parse_prerender_response(buffer)
      delimiter_index = buffer.index(PPR_POSTPONED_STATE_DELIMITER)
      unless delimiter_index
        raise ReactOnRailsPro::Error,
              "PPR prerender response missing #{PPR_POSTPONED_STATE_DELIMITER} delimiter. " \
              "Ensure the Node renderer returns shell HTML followed by the delimiter and PostponedState JSON."
      end

      shell_html = buffer[0...delimiter_index]
      postponed_state_json = buffer[(delimiter_index + PPR_POSTPONED_STATE_DELIMITER.length)..]&.strip

      if postponed_state_json.blank?
        raise ReactOnRailsPro::Error,
              "PPR prerender response has empty PostponedState after delimiter."
      end

      [shell_html, postponed_state_json]
    end

    def ppr_resume_stream(component_name, options, postponed_state)
      resume_options = options.merge(
        render_mode: :ppr_resume,
        ppr_postponed_state: postponed_state
      )
      result = internal_react_component(component_name, resume_options)
      render_opts = result[:render_options]
      result[:result].transform do |chunk_json_result|
        html = chunk_json_result["html"] || ""
        console_script = chunk_json_result["consoleReplayScript"]
        result_console_script = render_opts.replay_console ? wrap_console_script_with_nonce(console_script) : ""
        compose_react_component_html_with_spec_and_console("", html, result_console_script)
      end
    end
  end
end

ReactOnRailsProHelper.prepend(PPRPatches::ReactOnRailsProHelperPatch)

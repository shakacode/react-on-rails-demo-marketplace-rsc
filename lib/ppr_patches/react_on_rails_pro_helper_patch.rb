# frozen_string_literal: true

module PPRPatches
  # Adds ppr_react_component to the ReactOnRailsPro helper, implementing
  # Partial Prerendering with a two-phase render: prerender (shell + postponed
  # state) and resume (streamed dynamic content). Caches the shell to skip the
  # prerender phase on subsequent requests.
  module ReactOnRailsProHelperPatch
    PPR_POSTPONED_STATE_DELIMITER = '<!--PPR_POSTPONED_STATE-->'

    def ppr_react_component(component_name, raw_options = {}, &block)
      ReactOnRailsPro::Utils.with_trace(component_name) do
        check_caching_options!(raw_options, block)
        ppr_render_with_cache(component_name, options_with_auto_load_bundle(raw_options), &block)
      end
    end

    private

    def ppr_render_with_cache(component_name, render_options, &block)
      cache_key, write_opts = ppr_cache_key_and_options(component_name, render_options)
      cached = Rails.cache.read(cache_key, write_opts)

      if ppr_valid_cache?(cached)
        ppr_cache_hit(component_name, render_options, cached, &block)
      else
        ppr_cache_miss(component_name, render_options, cache_key, write_opts, &block)
      end
    end

    def ppr_cache_key_and_options(component_name, render_options)
      raw_cache_key = render_options[:cache_key]
      cache_key_value = raw_cache_key.respond_to?(:call) ? raw_cache_key.call : raw_cache_key

      key = ReactOnRailsPro::Cache.react_component_cache_key(
        component_name,
        render_options.merge(cache_key: ['ppr_react_component', cache_key_value], prerender: true)
      )
      write_opts = ReactOnRailsPro::Cache.cache_write_options(render_options[:cache_options] || {})
      [key, write_opts]
    end

    def ppr_valid_cache?(entry)
      entry.is_a?(Hash) && entry[:shell_html] && entry[:postponed_state]
    end

    def ppr_cache_hit(component_name, render_options, cached_entry)
      load_pack_for_cached_react_component(component_name, render_options)

      props = block_given? ? yield : {}
      options = render_options.merge(props:, prerender: true, skip_prerender_cache: true)

      ppr_schedule_resume(component_name, options, cached_entry[:postponed_state])
      ActiveSupport::SafeBuffer.new(cached_entry[:shell_html])
    end

    def ppr_cache_miss(component_name, render_options, cache_key, cache_write_options)
      props = yield
      options = render_options.merge(props:, prerender: true, skip_prerender_cache: true)
      shell_html, postponed_state = ppr_prerender(component_name, options)

      ppr_write_cache(cache_key, shell_html, postponed_state, render_options, cache_write_options)
      ppr_schedule_resume(component_name, options, postponed_state)
      ActiveSupport::SafeBuffer.new(shell_html)
    end

    def ppr_schedule_resume(component_name, options, postponed_state)
      on_complete = options.delete(:on_complete)
      first_chunk = consumer_stream_async(on_complete:) do
        ppr_resume_stream(component_name, options, postponed_state)
      end
      @main_output_queue.enqueue(first_chunk) if first_chunk.present?
    end

    def ppr_write_cache(key, shell_html, postponed_state, render_options, write_opts)
      Rails.cache.write(key, { shell_html:, postponed_state: }, write_opts)
      tags = ReactOnRailsPro::Cache.normalize_tags(render_options[:cache_tags])
      ReactOnRailsPro::Cache.register_normalized_tags(tags, key, write_opts)
    end

    def ppr_prerender(component_name, options)
      result = internal_react_component(component_name, options.merge(render_mode: :ppr_prerender))

      buffer = +''
      result[:result].each_chunk { |chunk| buffer << (chunk['html'] || '') }

      ppr_parse_prerender_response(buffer)
    end

    def ppr_parse_prerender_response(buffer)
      idx = buffer.index(PPR_POSTPONED_STATE_DELIMITER)
      raise ReactOnRailsPro::Error, ppr_missing_delimiter_message unless idx

      postponed = buffer[(idx + PPR_POSTPONED_STATE_DELIMITER.length)..]&.strip
      if postponed.blank?
        raise ReactOnRailsPro::Error,
              'PPR prerender response has empty PostponedState after delimiter.'
      end

      [buffer[0...idx], postponed]
    end

    def ppr_missing_delimiter_message
      "PPR prerender response missing #{PPR_POSTPONED_STATE_DELIMITER} delimiter. " \
        'Ensure the Node renderer returns shell HTML followed by the delimiter and PostponedState JSON.'
    end

    def ppr_resume_stream(component_name, options, postponed_state)
      result = internal_react_component(
        component_name,
        options.merge(render_mode: :ppr_resume, ppr_postponed_state: postponed_state)
      )
      render_opts = result[:render_options]

      result[:result].transform do |chunk|
        html = chunk['html'] || ''
        console = render_opts.replay_console ? wrap_console_script_with_nonce(chunk['consoleReplayScript']) : ''
        compose_react_component_html_with_spec_and_console('', html, console)
      end
    end
  end
end

ReactOnRailsProHelper.prepend(PPRPatches::ReactOnRailsProHelperPatch)

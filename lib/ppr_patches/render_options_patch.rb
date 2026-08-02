# frozen_string_literal: true

module PPRPatches
  # Adds Partial Prerendering render modes to React on Rails render options.
  module RenderOptionsPatch
    def streaming?
      %i[html_streaming rsc_payload_streaming ppr_prerender ppr_resume].include?(render_mode)
    end

    def ppr_prerender? = render_mode == :ppr_prerender

    def ppr_resume? = render_mode == :ppr_resume
  end
end

ReactOnRails::ReactComponent::RenderOptions.prepend(PPRPatches::RenderOptionsPatch)

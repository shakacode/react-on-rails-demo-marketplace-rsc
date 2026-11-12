# frozen_string_literal: true

if ENV['ENABLE_PPR'] == 'true'
  Rails.application.config.after_initialize do
    require_relative '../../lib/ppr_patches/render_options_patch'
    require_relative '../../lib/ppr_patches/server_rendering_js_code_patch'
    require_relative '../../lib/ppr_patches/react_on_rails_pro_helper_patch'

    Rails.logger.info '[PPR] Partial Prerendering patches loaded (ENABLE_PPR=true)'
  end
end

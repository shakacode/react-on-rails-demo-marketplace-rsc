# frozen_string_literal: true

require 'open3'
require 'rbconfig'

RSpec.describe 'PPR production boot' do
  it 'eager loads the PPR patches with Zeitwerk' do
    root = File.expand_path('..', __dir__)
    stdout, stderr, status = Open3.capture3(
      {
        'ENABLE_PPR' => 'true',
        'RAILS_ENV' => 'production',
        'SECRET_KEY_BASE' => 'dummy_secret_key_base_for_ppr_boot_spec'
      },
      RbConfig.ruby,
      File.join(root, 'bin/rails'),
      'runner',
      'puts "PPR_PRODUCTION_BOOT_OK"',
      chdir: root
    )

    expect(status).to be_success, "#{stdout}\n#{stderr}"
    expect(stdout).to include('PPR_PRODUCTION_BOOT_OK')
  end
end

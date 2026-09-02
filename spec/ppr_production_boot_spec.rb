# frozen_string_literal: true

require 'open3'
require 'rbconfig'

# Regression guard: RAILS_ENV=production eager-loads the whole app, including
# code paths ENABLE_PPR=true turns on. lib/ppr_patches is excluded from
# Zeitwerk's autoload_lib (config/application.rb) and loaded by hand via
# require_relative in config/initializers/ppr_patches.rb, specifically so
# Zeitwerk's inflector never has to resolve the PPRPatches constant — before
# that exclusion existed, production boot raised
# `NameError: uninitialized constant PprPatches::ReactOnRailsProHelperPatch`
# (Zeitwerk's default inflector expects lib/ppr_patches to define
# `PprPatches`, not `PPRPatches`). Keep this spec so a future change that
# re-adds ppr_patches to Zeitwerk's autoload path (removing the ignore) or
# otherwise breaks production boot under ENABLE_PPR=true fails fast in CI.
RSpec.describe 'PPR production boot' do
  it 'boots successfully with ENABLE_PPR=true' do
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

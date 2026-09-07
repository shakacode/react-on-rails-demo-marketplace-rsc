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
    # Bounded well above a normal boot (a few seconds locally and in CI) but
    # far short of this job's 15-minute budget, so a future hang (e.g. an
    # eager-loaded initializer blocking on I/O) fails in seconds with an
    # explicit message instead of silently eating the whole CI run.
    boot_timeout = 60
    stdout_str = +''
    stderr_str = +''
    status = nil
    timed_out = false

    Open3.popen3(
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
    ) do |stdin, stdout, stderr, wait_thr|
      stdin.close
      # Read stdout/stderr concurrently with waiting so a chatty child can't
      # deadlock on a full pipe buffer while we're blocked elsewhere.
      out_reader = Thread.new { stdout.read }
      err_reader = Thread.new { stderr.read }

      unless wait_thr.join(boot_timeout)
        timed_out = true
        begin
          Process.kill('KILL', wait_thr.pid)
        rescue Errno::ESRCH
          # already exited between the timeout check and the kill
        end
        wait_thr.join
      end

      stdout_str = out_reader.value
      stderr_str = err_reader.value
      status = wait_thr.value
    end

    if timed_out
      raise "PPR production boot did not finish within #{boot_timeout}s and was killed " \
            "(stdout: #{stdout_str.inspect}, stderr: #{stderr_str.inspect})"
    end

    expect(status).to be_success, "#{stdout_str}\n#{stderr_str}"
    expect(stdout_str).to include('PPR_PRODUCTION_BOOT_OK')
  end
end

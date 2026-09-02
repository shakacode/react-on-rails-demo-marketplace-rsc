# Add your own tasks in files placed in lib/tasks ending in .rake,
# for example lib/tasks/capistrano.rake, and they will automatically be available to Rake.

require_relative 'config/application'

Rails.application.load_tasks

# rspec-rails makes `spec` a prerequisite of the default rake task as soon as it
# loads. Two CI gates run `bundle exec rake` (via script/demo-fleet-verify)
# without a usable test database:
#
#   * demo-fleet-smoke.yml delegates to an upstream reusable workflow that
#     provisions no Postgres service at all;
#   * browser-smoke.yml runs the validation step with RAILS_ENV=test while
#     DATABASE_URL still points at its production-seeded smoke database.
#
# Booting RSpec there would fail on a connection error or an environment
# mismatch rather than on a real regression, so keep `rake` database-free — the
# suite has its own isolated job in .github/workflows/specs.yml. Run it directly
# with `bundle exec rspec`.
Rake::Task['default'].clear if Rake::Task.task_defined?('default')

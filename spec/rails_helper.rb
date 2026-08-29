# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

# Load support files (Shakapacker stub, factories, etc.).
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join('spec/fixtures')]
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  # Start every run from an empty database so specs are hermetic regardless of
  # any seed data in a local test DB (`db:prepare` seeds ~518k product_reviews).
  # CI loads a fresh schema with no seed, so this is effectively a no-op there.
  #
  # Guarded on the database name: this TRUNCATE runs outside the per-example
  # transaction and is therefore permanent, while DATABASE_URL can point the
  # test environment at a database that is not the test database (browser-smoke
  # .yml does exactly that, running RAILS_ENV=test against its production-seeded
  # smoke database). Only ever wipe a *_test database.
  config.before(:suite) do
    connection = ActiveRecord::Base.connection
    next unless connection.current_database.end_with?('_test')

    tables = connection.tables - %w[schema_migrations ar_internal_metadata]
    next if tables.empty?

    quoted = tables.map { |t| connection.quote_table_name(t) }.join(', ')
    connection.execute("TRUNCATE #{quoted} RESTART IDENTITY CASCADE")
  end
end

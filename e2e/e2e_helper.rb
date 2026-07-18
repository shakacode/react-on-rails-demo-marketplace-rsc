# frozen_string_literal: true

# CypressOnRails loads this file once before it evaluates an allowlisted app
# command. Scenario commands use the normal Rails application models directly.
module E2EDatabaseSafety
  TEST_DATABASE_SUFFIXES = %w[_test _playwright].freeze

  module_function

  def verify!
    database_name = ActiveRecord::Base.connection_db_config.database.to_s
    safe_database = Rails.env.test? && TEST_DATABASE_SUFFIXES.any? { |suffix| database_name.end_with?(suffix) }

    raise "Refusing E2E command against database #{database_name.inspect}" unless safe_database
  end
end

# Clears product fixtures only after verifying the E2E process uses a dedicated test database.
module E2EProductCleanup
  module_function

  def clean!
    E2EDatabaseSafety.verify!

    ProductReview.delete_all
    Product.delete_all
    Rails.cache.clear
  end
end

# Clears the deterministic restaurant fixture and its dependent records.
module E2ERestaurantCleanup
  module_function

  def clean!
    E2EDatabaseSafety.verify!

    OrderLine.delete_all
    Order.delete_all
    MenuItem.delete_all
    Restaurant.destroy_all
    Rails.cache.clear
  end
end

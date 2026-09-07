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
  RESTAURANT_ID = 146_086

  module_function

  def clean!
    E2EDatabaseSafety.verify!

    restaurant = Restaurant.find_by(id: RESTAURANT_ID)
    destroy_fixture!(restaurant) if restaurant
    Rails.cache.clear
  end

  def destroy_fixture!(restaurant)
    fixture_order_ids = restaurant.orders.select(:id)
    fixture_menu_item_ids = restaurant.menu_items.select(:id)
    OrderLine
      .where(order_id: fixture_order_ids)
      .or(OrderLine.where(menu_item_id: fixture_menu_item_ids))
      .delete_all
    restaurant.destroy!
  end
  private_class_method :destroy_fixture!
end

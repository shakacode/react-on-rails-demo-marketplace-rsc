# frozen_string_literal: true

# These three composite indexes were observed in db/schema.rb but never had a
# matching migration. The dashboard analytics queries — KPI stats, revenue
# by day, hourly distribution, recent orders — all hit `orders.placed_at` and
# join `order_lines` by `order_id`. Without these indexes the queries fall
# back to seq scans on 10M+ rows in full-seed mode.
class AddDashboardQueryIndexes < ActiveRecord::Migration[7.2]
  def change
    add_index :orders, :placed_at, name: "idx_orders_placed_at",
              if_not_exists: true
    add_index :orders, %i[placed_at status], name: "idx_orders_placed_at_status",
              if_not_exists: true
    add_index :order_lines, %i[order_id menu_item_id quantity price_per_unit],
              name: "idx_order_lines_order_menu", if_not_exists: true
  end
end

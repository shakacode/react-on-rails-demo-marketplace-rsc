# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_05_04_170000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "hours", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.integer "day_of_week", null: false
    t.time "opens_at"
    t.time "closes_at"
    t.boolean "is_closed", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["restaurant_id", "day_of_week"], name: "index_hours_on_restaurant_id_and_day_of_week"
    t.index ["restaurant_id"], name: "index_hours_on_restaurant_id"
  end

  create_table "menu_items", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.decimal "price", precision: 8, scale: 2, null: false
    t.integer "prep_time_minutes"
    t.boolean "is_available", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["restaurant_id", "category"], name: "index_menu_items_on_restaurant_id_and_category"
    t.index ["restaurant_id"], name: "index_menu_items_on_restaurant_id"
  end

  create_table "order_lines", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "menu_item_id", null: false
    t.integer "quantity", default: 1, null: false
    t.decimal "price_per_unit", precision: 8, scale: 2, null: false
    t.text "special_instructions"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["menu_item_id"], name: "index_order_lines_on_menu_item_id"
    t.index ["order_id", "menu_item_id", "quantity", "price_per_unit"], name: "idx_order_lines_order_menu"
    t.index ["order_id"], name: "index_order_lines_on_order_id"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.string "order_number", null: false
    t.string "status", default: "pending", null: false
    t.datetime "placed_at", null: false
    t.datetime "estimated_ready_time"
    t.datetime "actual_ready_time"
    t.datetime "completed_at"
    t.decimal "total_price", precision: 10, scale: 2, null: false
    t.boolean "is_delivery", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_number"], name: "index_orders_on_order_number", unique: true
    t.index ["placed_at", "status"], name: "idx_orders_placed_at_status"
    t.index ["placed_at"], name: "idx_orders_placed_at"
    t.index ["restaurant_id", "completed_at"], name: "index_orders_on_restaurant_id_and_completed_at"
    t.index ["restaurant_id", "created_at"], name: "index_orders_on_restaurant_id_and_created_at", order: { created_at: :desc }
    t.index ["restaurant_id", "status"], name: "index_orders_on_restaurant_id_and_status"
    t.index ["restaurant_id"], name: "index_orders_on_restaurant_id"
  end

  create_table "product_reviews", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.integer "rating", null: false
    t.string "title"
    t.text "comment"
    t.string "reviewer_name", null: false
    t.boolean "verified_purchase", default: false
    t.integer "helpful_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id", "created_at"], name: "index_product_reviews_on_product_id_and_created_at"
    t.index ["product_id", "helpful_count"], name: "index_product_reviews_on_product_id_and_helpful_count"
    t.index ["product_id", "rating"], name: "index_product_reviews_on_product_id_and_rating"
    t.index ["product_id"], name: "index_product_reviews_on_product_id"
  end

  create_table "products", force: :cascade do |t|
    t.string "name", null: false
    t.text "description", null: false
    t.decimal "price", precision: 10, scale: 2, null: false
    t.decimal "original_price", precision: 10, scale: 2
    t.string "category", null: false
    t.string "brand", null: false
    t.string "sku", null: false
    t.jsonb "images", default: []
    t.jsonb "specs", default: {}
    t.jsonb "features", default: []
    t.decimal "average_rating", precision: 3, scale: 2, default: "0.0"
    t.integer "review_count", default: 0
    t.integer "stock_quantity", default: 100
    t.boolean "in_stock", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "tags", default: []
    t.index ["brand"], name: "index_products_on_brand"
    t.index ["category"], name: "index_products_on_category"
    t.index ["price"], name: "index_products_on_price"
    t.index ["sku"], name: "index_products_on_sku", unique: true
    t.index ["tags"], name: "index_products_on_tags", using: :gin
  end

  create_table "promotions", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "discount_type", null: false
    t.decimal "discount_value", precision: 8, scale: 2, null: false
    t.string "code"
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_promotions_on_code"
    t.index ["restaurant_id", "ends_at"], name: "index_promotions_on_restaurant_id_and_ends_at"
    t.index ["restaurant_id", "starts_at", "ends_at"], name: "index_promotions_on_restaurant_id_and_starts_at_and_ends_at"
    t.index ["restaurant_id"], name: "index_promotions_on_restaurant_id"
  end

  create_table "restaurants", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "cuisine_type", null: false
    t.decimal "latitude", precision: 10, scale: 7
    t.decimal "longitude", precision: 10, scale: 7
    t.string "address"
    t.string "city"
    t.string "state"
    t.string "zip_code"
    t.string "phone"
    t.string "website"
    t.string "timezone", default: "America/New_York", null: false
    t.decimal "average_rating", precision: 3, scale: 2, default: "0.0"
    t.integer "review_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "image_url"
    t.index ["average_rating"], name: "index_restaurants_on_average_rating"
    t.index ["city"], name: "index_restaurants_on_city"
    t.index ["cuisine_type"], name: "index_restaurants_on_cuisine_type"
  end

  create_table "reviews", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.integer "rating", null: false
    t.string "title"
    t.text "comment"
    t.string "reviewer_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["restaurant_id", "created_at"], name: "index_reviews_on_restaurant_id_and_created_at"
    t.index ["restaurant_id"], name: "index_reviews_on_restaurant_id"
    t.check_constraint "rating >= 1 AND rating <= 5", name: "reviews_rating_check"
  end

  create_table "special_hours", force: :cascade do |t|
    t.bigint "restaurant_id", null: false
    t.date "date", null: false
    t.time "opens_at"
    t.time "closes_at"
    t.boolean "is_closed", default: false
    t.string "reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["restaurant_id", "date"], name: "index_special_hours_on_restaurant_id_and_date", unique: true
    t.index ["restaurant_id"], name: "index_special_hours_on_restaurant_id"
  end

  add_foreign_key "hours", "restaurants"
  add_foreign_key "menu_items", "restaurants"
  add_foreign_key "order_lines", "menu_items", on_delete: :restrict
  add_foreign_key "order_lines", "orders", on_delete: :cascade
  add_foreign_key "orders", "restaurants"
  add_foreign_key "product_reviews", "products"
  add_foreign_key "promotions", "restaurants"
  add_foreign_key "reviews", "restaurants"
  add_foreign_key "special_hours", "restaurants"
end

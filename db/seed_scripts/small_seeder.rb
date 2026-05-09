# frozen_string_literal: true

class SmallSeeder
  def self.seed!
    puts "=== SMALL SEED MODE (Testing) ==="
    puts "Creating minimal data for development testing..."
    start_time = Time.now

    # Small dataset - just enough to test functionality
    BaseSeeder.seed_restaurants(count: 500)
    BaseSeeder.seed_hours
    BaseSeeder.seed_special_hours
    BaseSeeder.seed_reviews(count: 5_000)
    BaseSeeder.seed_menu_items(count: 2_000)
    BaseSeeder.seed_promotions(count: 250)
    BaseSeeder.seed_orders(count: 10_000)
    BaseSeeder.seed_order_lines

    elapsed = ((Time.now - start_time) / 60).round(2)
    puts "\n=== Small seed complete in #{elapsed} minutes! ==="
    puts "Run 'SEED_MODE=full rails db:seed' for production data (62M+ records)"
  end
end

# frozen_string_literal: true

class BaseSeeder
  CUISINES = %w[Italian Mexican Chinese Japanese Thai Indian American French Mediterranean Greek Vietnamese Korean].freeze
  TIMEZONES = %w[America/New_York America/Chicago America/Denver America/Los_Angeles America/Phoenix].freeze
  CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'].freeze
  STATES = %w[NY CA IL TX AZ PA TX CA].freeze
  STATUSES = %w[completed ready preparing pending cancelled].freeze
  CATEGORIES = %w[Appetizers Entrees Desserts Beverages Sides Specials].freeze

  class << self
    def seed_restaurants(count:)
      puts "\nSeeding #{count} restaurants..."

      batch_size = [count, 1000].min
      batches = (count / batch_size.to_f).ceil

      batches.times do |batch_num|
        batch_count = [batch_size, count - (batch_num * batch_size)].min
        records = batch_count.times.map do |i|
          idx = batch_num * batch_size + i
          {
            name: "Restaurant #{idx + 1}",
            description: "A wonderful #{CUISINES.sample} restaurant serving authentic cuisine",
            cuisine_type: CUISINES.sample,
            timezone: TIMEZONES.sample,
            latitude: rand(25.0..48.0).round(7),
            longitude: rand(-122.0..-71.0).round(7),
            address: "#{rand(100..9999)} Main St",
            city: CITIES.sample,
            state: STATES.sample,
            zip_code: format('%05d', rand(10_000..99_999)),
            phone: format('(%03d) %03d-%04d', rand(200..999), rand(200..999), rand(1000..9999)),
            average_rating: rand(3.0..5.0).round(2),
            review_count: rand(10..500),
            image_url: "/seed-images/restaurants/#{(idx % 100) + 1}.jpg",
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        Restaurant.insert_all(records)
        print '.'
      end

      puts "\nRestaurants: #{Restaurant.count}"
    end

    def seed_hours
      puts "\nSeeding hours..."

      restaurant_ids = Restaurant.pluck(:id)
      records = []

      restaurant_ids.each do |restaurant_id|
        7.times do |day|
          opens = Time.parse("#{rand(6..10)}:00")
          closes = Time.parse("#{rand(20..23)}:00")

          records << {
            restaurant_id: restaurant_id,
            day_of_week: day,
            opens_at: opens,
            closes_at: closes,
            is_closed: day == 0 && rand < 0.3, # 30% chance closed on Sunday
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        if records.size >= 10_000
          Hour.insert_all(records)
          records = []
          print '.'
        end
      end

      Hour.insert_all(records) if records.any?
      puts "\nHours: #{Hour.count}"
    end

    def seed_special_hours
      puts "\nSeeding special hours..."

      restaurant_ids = Restaurant.pluck(:id)
      records = []
      holidays = [Date.new(2024, 12, 25), Date.new(2024, 1, 1), Date.new(2024, 7, 4)]

      restaurant_ids.each do |restaurant_id|
        holidays.sample(rand(1..3)).each do |date|
          records << {
            restaurant_id: restaurant_id,
            date: date,
            opens_at: nil,
            closes_at: nil,
            is_closed: true,
            reason: 'Holiday',
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        if records.size >= 10_000
          SpecialHour.insert_all(records)
          records = []
          print '.'
        end
      end

      SpecialHour.insert_all(records) if records.any?
      puts "\nSpecial Hours: #{SpecialHour.count}"
    end

    def seed_reviews(count:)
      puts "\nSeeding #{count} reviews..."

      restaurant_ids = Restaurant.pluck(:id)
      batch_size = 10_000
      batches = (count / batch_size.to_f).ceil

      batches.times do |batch_num|
        batch_count = [batch_size, count - (batch_num * batch_size)].min
        records = batch_count.times.map do
          {
            restaurant_id: restaurant_ids.sample,
            rating: rand(1..5),
            title: ['Great food!', 'Loved it', 'Will come back', 'Decent', 'Amazing experience'].sample,
            comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            reviewer_name: "User#{rand(1000..9999)}",
            created_at: rand(90.days).seconds.ago,
            updated_at: Time.current
          }
        end

        Review.insert_all(records)
        print '.'
      end

      puts "\nReviews: #{Review.count}"
    end

    def seed_menu_items(count:)
      puts "\nSeeding #{count} menu items..."

      restaurant_ids = Restaurant.pluck(:id)
      items_per_restaurant = (count / restaurant_ids.size.to_f).ceil
      batch_size = 10_000
      records = []

      restaurant_ids.each_with_index do |restaurant_id, idx|
        items_per_restaurant.times do |i|
          records << {
            restaurant_id: restaurant_id,
            name: "Item #{i + 1}",
            description: 'Delicious dish prepared with fresh ingredients',
            category: CATEGORIES.sample,
            price: rand(8.99..45.99).round(2),
            prep_time_minutes: rand(10..45),
            is_available: rand < 0.95,
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        next unless records.size >= batch_size

        MenuItem.insert_all(records)
        records = []
        print '.'
      end

      MenuItem.insert_all(records) if records.any?
      puts "\nMenu Items: #{MenuItem.count}"
    end

    def seed_promotions(count:)
      puts "\nSeeding #{count} promotions..."

      restaurant_ids = Restaurant.pluck(:id)
      batch_size = 10_000
      batches = (count / batch_size.to_f).ceil

      batches.times do |batch_num|
        batch_count = [batch_size, count - (batch_num * batch_size)].min
        records = batch_count.times.map do
          starts = rand(30.days).seconds.ago
          {
            restaurant_id: restaurant_ids.sample,
            title: ['Happy Hour', '20% Off', 'Free Dessert', 'Buy One Get One', 'Lunch Special'].sample,
            description: 'Limited time offer!',
            discount_type: %w[percentage fixed_amount free_item].sample,
            discount_value: rand(5..30),
            code: "PROMO#{rand(1000..9999)}",
            starts_at: starts,
            ends_at: starts + rand(7..30).days,
            is_active: rand < 0.8,
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        Promotion.insert_all(records)
        print '.'
      end

      puts "\nPromotions: #{Promotion.count}"
    end

    def seed_orders(count:)
      puts "\nSeeding #{format_number(count)} orders..."

      restaurant_ids = Restaurant.pluck(:id)
      batch_size = 50_000
      batches = (count / batch_size.to_f).ceil

      batches.times do |batch_num|
        batch_count = [batch_size, count - (batch_num * batch_size)].min

        # Use raw SQL for maximum speed
        values = batch_count.times.map do |i|
          restaurant_id = restaurant_ids.sample
          placed_at = rand(90.days).seconds.ago
          status = STATUSES.sample
          completed_at = status == 'completed' ? placed_at + rand(15..60).minutes : nil

          "(#{restaurant_id}, 'ORD-#{batch_num}-#{i}', '#{status}', " \
            "'#{placed_at.to_fs(:db)}', #{rand(20.0..150.0).round(2)}, " \
            "#{rand < 0.3}, '#{Time.current.to_fs(:db)}', '#{Time.current.to_fs(:db)}'" \
            "#{completed_at ? ", '#{completed_at.to_fs(:db)}'" : ', NULL'})"
        end.join(",\n")

        sql = <<~SQL
          INSERT INTO orders
            (restaurant_id, order_number, status, placed_at, total_price, is_delivery, created_at, updated_at, completed_at)
          VALUES #{values}
        SQL

        ActiveRecord::Base.connection.execute(sql)

        # Progress indicator
        progress = ((batch_num + 1) * 100.0 / batches).round(1)
        print "\r  Progress: #{batch_num + 1}/#{batches} (#{progress}%)"

        # Prevent memory bloat
        GC.start if batch_num % 20 == 0
      end

      puts "\nOrders: #{format_number(Order.count)}"
    end

    def seed_order_lines
      puts "\nSeeding order lines..."

      menu_item_ids = MenuItem.pluck(:id)
      order_ids = Order.pluck(:id)

      batch_size = 50_000
      records = []
      total = 0

      order_ids.each_slice(10_000) do |order_batch|
        order_batch.each do |order_id|
          # 1-5 items per order
          rand(1..5).times do
            records << {
              order_id: order_id,
              menu_item_id: menu_item_ids.sample,
              quantity: rand(1..3),
              price_per_unit: rand(8.99..45.99).round(2),
              special_instructions: nil,
              created_at: Time.current,
              updated_at: Time.current
            }
          end

          next unless records.size >= batch_size

          OrderLine.insert_all(records)
          total += records.size
          records = []
          print "\r  Order lines created: #{format_number(total)}"
        end
      end

      if records.any?
        OrderLine.insert_all(records)
        total += records.size
      end

      puts "\nOrder Lines: #{format_number(OrderLine.count)}"
    end

    private

    def format_number(num)
      num.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    end
  end
end

# Main seed file - determines which script to run
mode = ENV.fetch('SEED_MODE', 'small')

require_relative 'seed_scripts/base_seeder'
require_relative 'seed_scripts/product_seeder'
require_relative 'seed_scripts/search_product_seeder'

case mode
when 'small'
  require_relative 'seed_scripts/small_seeder'
  SmallSeeder.seed!
when 'full'
  require_relative 'seed_scripts/full_seeder'
  FullSeeder.seed!
else
  puts "Unknown SEED_MODE: #{mode}. Use 'small' or 'full'"
  exit 1
end

# Always seed products (idempotent)
reviews_count = mode == 'full' ? 100_000 : 50_000
ProductSeeder.seed!(reviews_per_product: reviews_count)
SearchProductSeeder.seed!

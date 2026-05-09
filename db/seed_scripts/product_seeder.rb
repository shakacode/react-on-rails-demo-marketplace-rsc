# frozen_string_literal: true

class ProductSeeder
  REVIEW_TITLES_5 = [
    'Absolutely amazing!', 'Best purchase ever!', 'Exceeded expectations',
    'Outstanding quality', 'Highly recommend!', 'Worth every penny',
    'Perfect in every way', 'Game changer!', 'Love everything about it',
    'Five stars is not enough'
  ].freeze

  REVIEW_TITLES_4 = [
    'Great product overall', 'Very satisfied', 'Really good quality',
    'Minor quibbles but great', 'Solid purchase', 'Happy with this',
    'Good value for money', 'Impressed', 'Does what it promises',
    'Would buy again'
  ].freeze

  REVIEW_TITLES_3 = [
    'Decent but not amazing', 'Average product', 'It is okay',
    'Expected more', 'Has pros and cons', 'Middle of the road',
    'Gets the job done', 'Nothing special', 'Fair for the price',
    'Acceptable quality'
  ].freeze

  REVIEW_TITLES_2 = [
    'Disappointed', 'Below expectations', 'Not great',
    'Could be much better', 'Quality issues', 'Overpriced',
    'Would not recommend', 'Underwhelming', 'Had problems',
    'Not worth the price'
  ].freeze

  REVIEW_TITLES_1 = [
    'Terrible product', 'Complete waste of money', 'Do not buy',
    'Broke after a week', 'Worst purchase ever', 'Very poor quality',
    'Total disappointment', 'Want a refund', 'Horrible experience',
    'Stay away from this'
  ].freeze

  REVIEW_COMMENTS = {
    5 => [
      "I've been using this for several months now and I couldn't be happier. The build quality is exceptional and it performs exactly as advertised. The sound quality is crystal clear with deep bass and crisp highs.",
      "After researching dozens of options, I went with this and it was the best decision. The noise cancellation is truly impressive - it blocks out airplane engines, office chatter, and city noise completely.",
      "This is my third pair of premium headphones and by far the best. The comfort level is unmatched - I can wear them for 8+ hours during work without any discomfort. Battery life is insane too.",
      "Bought these for my daily commute and they transformed my experience. The spatial audio feature makes music feel live. Pairing was instant and switching between devices is seamless.",
      "The attention to detail in this product is remarkable. From the premium packaging to the carrying case, everything feels luxury. Sound signature is warm and detailed with excellent instrument separation."
    ],
    4 => [
      "Very good headphones with great sound quality. The only minor issue is that the touch controls can be a bit finicky in cold weather, but otherwise they're excellent for daily use.",
      "Solid build quality and impressive noise cancellation. Battery life exceeds the stated specs. I'd give 5 stars but the app could use some improvements in the EQ customization area.",
      "Great value for premium headphones. The sound is rich and detailed. Comfort is good for the first few hours but my ears do get a bit warm after extended listening sessions.",
      "Really enjoying these. The multipoint connection works flawlessly between my phone and laptop. The mic quality for calls is better than expected. Just wish they folded a bit more compact.",
      "Impressive noise cancellation and sound quality. The transparency mode is natural sounding. Took a star off because the headband could use a tiny bit more padding for all-day wear."
    ],
    3 => [
      "They sound decent and the noise cancellation works, but I expected more at this price point. The bass can be a bit overwhelming with certain genres. Comfort is average.",
      "Good headphones with some caveats. Sound quality is fine for most use cases but audiophiles might want something more refined. The app features are basic compared to competitors.",
      "These are okay. They do what they're supposed to do. The build feels solid but the plastic joints make me wonder about long-term durability. Sound is good but not exceptional.",
      "Mixed feelings about these. The noise cancellation is very effective but introduces a slight hiss. Sound quality improves significantly after adjusting the EQ in the app.",
      "Average product for the price. There are better options available if you're willing to spend a bit more or look at other brands. That said, they're not bad by any means."
    ],
    2 => [
      "Disappointed with the sound quality at this price point. The bass is muddy and the treble sounds harsh at higher volumes. Expected much better from a premium brand.",
      "Build quality feels cheaper than the price suggests. The headband creaks when adjusting, and the ear cups don't rotate enough for comfortable neck rest. Sound is just okay.",
      "Had connectivity issues from day one. Keeps dropping Bluetooth connection randomly. When it works, the sound is decent, but the reliability issues are frustrating.",
      "The noise cancellation creates an uncomfortable pressure sensation in my ears. Sound quality is mediocre - I've heard better from headphones at half the price.",
      "Returned these after a week. The comfort level is poor for anyone with larger ears - the cups are too shallow. Also, the touch controls register phantom touches constantly."
    ],
    1 => [
      "Complete waste of money. Stopped working after two weeks. Customer service was unhelpful and the warranty process is a nightmare. Save your money.",
      "Terrible quality control. Received a unit with a dead right driver. The replacement had buzzing in the left cup. Done trying with this brand.",
      "The worst headphones I've ever owned. Uncomfortable, bad sound, poor noise cancellation. The app is buggy and drains phone battery. Everything about this is bad.",
      "Broke within the first month. The headband snapped at the hinge while carefully taking them off. For the premium price, the build quality is inexcusably poor.",
      "Do not buy these. The advertised 40-hour battery life is a joke - I get maybe 15 hours. Noise cancellation barely works. Sounds like you're listening through a tin can."
    ]
  }.freeze

  FIRST_NAMES = %w[James Mary Robert Patricia John Jennifer Michael Linda David Elizabeth Sarah Thomas Christopher Karen Daniel Nancy Matthew Betty Anthony Sandra].freeze
  LAST_NAMES = %w[Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Wilson Anderson Taylor Thomas Moore Jackson Martin Lee].freeze

  PRODUCTS = [
    {
      name: 'ProSound Elite X1 Wireless Headphones',
      description: <<~MARKDOWN,
        ## Overview

        The ProSound Elite X1 represents the pinnacle of wireless audio technology. Engineered for audiophiles and professionals alike, these over-ear headphones deliver **studio-grade sound** with industry-leading active noise cancellation.

        Featuring our proprietary **TrueSound 50mm drivers** with bio-cellulose diaphragms, the Elite X1 reproduces every nuance of your music with stunning clarity and depth. From the deepest bass frequencies to crystalline highs, experience your favorite tracks like never before.

        ## Key Highlights

        - **Adaptive Noise Cancellation** with 6 microphones that continuously analyze and filter ambient sound
        - **40-hour battery life** with ANC enabled, 60 hours without
        - **Hi-Res Audio certified** with support for LDAC, aptX HD, and AAC codecs
        - **Multipoint connection** - seamlessly switch between two devices
        - **Spatial Audio** with head tracking for immersive 3D soundstage

        ## Design & Comfort

        Crafted with premium materials including **memory foam ear cushions** wrapped in protein leather and a lightweight titanium headband, the Elite X1 is designed for all-day comfort. The ergonomic oval ear cups fully enclose your ears, creating a natural seal that enhances both noise isolation and bass response.

        The minimalist design features an elegant matte finish with brushed aluminum accents. Available in **Midnight Black**, **Arctic White**, **Navy Blue**, and **Forest Green**.

        ## Smart Features

        The ProSound app gives you complete control over your listening experience:

        - Custom EQ with 10-band parametric equalizer
        - Adjustable noise cancellation levels (1-10)
        - Transparency mode with voice focus
        - Find My Headphones with last-known location
        - Firmware updates over-the-air

        ## Connectivity

        ```json
        {
          "bluetooth_version": "5.3",
          "codecs": ["SBC", "AAC", "aptX", "aptX HD", "LDAC"],
          "range": "15m (50ft)",
          "multipoint": true,
          "nfc_pairing": true,
          "wired_option": "3.5mm / USB-C"
        }
        ```

        ## What's in the Box

        - ProSound Elite X1 Headphones
        - Premium hard-shell carrying case
        - USB-C charging cable (1.5m)
        - 3.5mm audio cable (1.2m)
        - Airplane adapter
        - Quick start guide
        - 2-year warranty card
      MARKDOWN
      price: 299.99,
      original_price: 349.99,
      category: 'Headphones',
      brand: 'ProSound',
      sku: 'PS-EX1-BLK',
      images: [
        { url: '/seed-images/products/prod-8c9dd58ee973.jpg', alt: 'ProSound Elite X1 - Front view', position: 0 },
        { url: '/seed-images/products/prod-5b41d7bf90c5.jpg', alt: 'ProSound Elite X1 - Side view', position: 1 },
        { url: '/seed-images/products/prod-373176361650.jpg', alt: 'ProSound Elite X1 - On desk', position: 2 },
        { url: '/seed-images/products/prod-5f57261d29af.jpg', alt: 'ProSound Elite X1 - Lifestyle', position: 3 },
        { url: '/seed-images/products/prod-099d1fe16bd0.jpg', alt: 'ProSound Elite X1 - Detail', position: 4 }
      ],
      specs: {
        'Driver Size' => '50mm Bio-cellulose',
        'Frequency Response' => '4Hz - 40kHz',
        'Impedance' => '32 ohm',
        'Sensitivity' => '108 dB/mW',
        'Bluetooth Version' => '5.3',
        'Bluetooth Codecs' => 'SBC, AAC, aptX, aptX HD, LDAC',
        'Battery Life (ANC On)' => '40 hours',
        'Battery Life (ANC Off)' => '60 hours',
        'Charging Time' => '2 hours (10 min = 5 hrs)',
        'Charging Port' => 'USB-C',
        'Weight' => '250g',
        'Noise Cancellation' => 'Adaptive ANC with 6 mics',
        'Microphones' => '6 (4 ANC + 2 voice)',
        'Water Resistance' => 'IPX4',
        'Foldable' => 'Yes'
      },
      features: [
        'Adaptive noise cancellation with 6-microphone array',
        '40-hour battery life with quick charge (10 min = 5 hours)',
        'Hi-Res Audio certified with LDAC and aptX HD support',
        'Multipoint Bluetooth for seamless device switching',
        'Spatial Audio with dynamic head tracking',
        'Premium memory foam ear cushions for all-day comfort',
        'Customizable EQ with 10-band parametric equalizer',
        'Transparency mode with voice focus technology'
      ],
      average_rating: 4.3,
      review_count: 0,
      stock_quantity: 142
    },
    {
      name: 'ProSound Sport Flex Earbuds',
      description: 'True wireless earbuds designed for active lifestyles with IP67 water resistance and secure-fit ear hooks.',
      price: 149.99,
      original_price: 179.99,
      category: 'Headphones',
      brand: 'ProSound',
      sku: 'PS-SF-BLK',
      images: [
        { url: '/seed-images/products/prod-523f15e2c426.jpg', alt: 'ProSound Sport Flex Earbuds', position: 0 }
      ],
      specs: { 'Type' => 'True Wireless', 'Battery' => '8 + 24 hours', 'Water Resistance' => 'IP67' },
      features: ['IP67 water resistance', 'Secure-fit ear hooks', '32-hour total battery life'],
      average_rating: 4.5,
      review_count: 0,
      stock_quantity: 230
    },
    {
      name: 'ProSound Studio Monitor Pro',
      description: 'Professional studio headphones with flat frequency response for accurate audio monitoring and mixing.',
      price: 449.99,
      original_price: nil,
      category: 'Headphones',
      brand: 'ProSound',
      sku: 'PS-SMP-SLV',
      images: [
        { url: '/seed-images/products/prod-52359cc7abd1.jpg', alt: 'ProSound Studio Monitor Pro', position: 0 }
      ],
      specs: { 'Type' => 'Over-ear Wired', 'Driver' => '53mm Beryllium', 'Impedance' => '64 ohm' },
      features: ['Flat frequency response', 'Replaceable ear pads', 'Detachable cable system'],
      average_rating: 4.7,
      review_count: 0,
      stock_quantity: 58
    },
    {
      name: 'AudioTech BassMax Pro 500',
      description: 'Bass-enhanced wireless headphones with custom-tuned drivers for deep, powerful low frequencies.',
      price: 199.99,
      original_price: 249.99,
      category: 'Headphones',
      brand: 'AudioTech',
      sku: 'AT-BMP500',
      images: [
        { url: '/seed-images/products/prod-79f42823aa46.jpg', alt: 'AudioTech BassMax Pro 500', position: 0 }
      ],
      specs: { 'Type' => 'Over-ear Wireless', 'Driver' => '45mm Dynamic', 'Battery' => '35 hours' },
      features: ['BassMax technology', '35-hour battery life', 'Foldable design'],
      average_rating: 4.1,
      review_count: 0,
      stock_quantity: 189
    },
    {
      name: 'SoundWave Clarity 700',
      description: 'Premium noise-canceling headphones with crystal clear sound reproduction and elegant design.',
      price: 279.99,
      original_price: nil,
      category: 'Headphones',
      brand: 'SoundWave',
      sku: 'SW-CL700',
      images: [
        { url: '/seed-images/products/prod-897b3f7d34a4.jpg', alt: 'SoundWave Clarity 700', position: 0 }
      ],
      specs: { 'Type' => 'Over-ear Wireless', 'Driver' => '40mm Graphene', 'Battery' => '45 hours' },
      features: ['Advanced ANC', '45-hour battery', 'Graphene drivers'],
      average_rating: 4.4,
      review_count: 0,
      stock_quantity: 95
    },
    {
      name: 'ProSound Travel Case Premium',
      description: 'Hard-shell carrying case with memory foam interior, designed specifically for ProSound headphones.',
      price: 39.99,
      original_price: nil,
      category: 'Accessories',
      brand: 'ProSound',
      sku: 'PS-TCP',
      images: [
        { url: '/seed-images/products/prod-d77aabc54975.jpg', alt: 'ProSound Travel Case', position: 0 }
      ],
      specs: { 'Material' => 'EVA Hard Shell', 'Interior' => 'Memory Foam', 'Weight' => '180g' },
      features: ['Hard-shell protection', 'Memory foam interior', 'Cable storage pocket'],
      average_rating: 4.6,
      review_count: 0,
      stock_quantity: 320
    },
    {
      name: 'ProSound USB-C DAC Adapter',
      description: 'Portable hi-res USB-C to 3.5mm DAC with 32-bit/384kHz support for audiophile-grade mobile listening.',
      price: 49.99,
      original_price: nil,
      category: 'Accessories',
      brand: 'ProSound',
      sku: 'PS-DAC-C',
      images: [
        { url: '/seed-images/products/prod-0e6fd53f4bff.jpg', alt: 'ProSound USB-C DAC', position: 0 }
      ],
      specs: { 'DAC Chip' => 'ESS ES9281AC', 'Output' => '3.5mm', 'Resolution' => '32-bit/384kHz' },
      features: ['Hi-res audio decoding', 'Ultra-portable design', 'Low power consumption'],
      average_rating: 4.3,
      review_count: 0,
      stock_quantity: 415
    },
    {
      name: 'NovaBeat Pulse ANC',
      description: 'Colorful wireless headphones with adaptive noise cancellation and bold, youth-friendly design.',
      price: 129.99,
      original_price: 159.99,
      category: 'Headphones',
      brand: 'NovaBeat',
      sku: 'NB-PANC',
      images: [
        { url: '/seed-images/products/prod-09144710e68e.jpg', alt: 'NovaBeat Pulse ANC', position: 0 }
      ],
      specs: { 'Type' => 'Over-ear Wireless', 'Driver' => '40mm', 'Battery' => '30 hours' },
      features: ['Adaptive ANC', '30-hour battery', 'Available in 6 colors'],
      average_rating: 4.0,
      review_count: 0,
      stock_quantity: 267
    },
    {
      name: 'ProSound Replacement Ear Pads (Elite Series)',
      description: 'Premium protein leather ear pads with memory foam for ProSound Elite X1 and X2 headphones.',
      price: 29.99,
      original_price: nil,
      category: 'Accessories',
      brand: 'ProSound',
      sku: 'PS-REP-ELT',
      images: [
        { url: '/seed-images/products/prod-5ab161943b85.jpg', alt: 'ProSound Replacement Ear Pads', position: 0 }
      ],
      specs: { 'Material' => 'Protein Leather', 'Foam' => 'Memory Foam', 'Compatibility' => 'Elite X1, X2' },
      features: ['Premium protein leather', 'Memory foam cushioning', 'Easy snap-on installation'],
      average_rating: 4.8,
      review_count: 0,
      stock_quantity: 543
    },
    {
      name: 'AudioTech SurroundPro 360',
      description: 'Gaming headset with 7.1 virtual surround sound, detachable boom mic, and RGB lighting.',
      price: 169.99,
      original_price: 199.99,
      category: 'Headphones',
      brand: 'AudioTech',
      sku: 'AT-SP360',
      images: [
        { url: '/seed-images/products/prod-2eee751108e3.jpg', alt: 'AudioTech SurroundPro 360', position: 0 }
      ],
      specs: { 'Type' => 'Over-ear Gaming', 'Driver' => '50mm Neodymium', 'Surround' => '7.1 Virtual' },
      features: ['7.1 virtual surround', 'Detachable boom mic', 'RGB lighting effects'],
      average_rating: 4.2,
      review_count: 0,
      stock_quantity: 178
    }
  ].freeze

  class << self
    def seed!(reviews_per_product: 50_000)
      seed_products
      seed_product_reviews(reviews_per_product: reviews_per_product)
      update_cached_ratings
    end

    private

    def seed_products
      puts "\nSeeding products..."

      PRODUCTS.each do |attrs|
        Product.find_or_create_by!(sku: attrs[:sku]) do |p|
          p.assign_attributes(attrs)
        end
      end

      puts "Products: #{Product.count}"
    end

    def seed_product_reviews(reviews_per_product:)
      return if ProductReview.count > 0

      product_ids = Product.pluck(:id)
      total = product_ids.size * reviews_per_product
      puts "\nSeeding #{format_number(total)} product reviews (#{format_number(reviews_per_product)} per product)..."

      product_ids.each_with_index do |product_id, prod_idx|
        batch_size = 10_000
        batches = (reviews_per_product / batch_size.to_f).ceil

        batches.times do |batch_num|
          batch_count = [batch_size, reviews_per_product - (batch_num * batch_size)].min

          values = batch_count.times.map do
            rating = weighted_rating
            title = title_for_rating(rating)
            comment = comment_for_rating(rating)
            reviewer = "#{FIRST_NAMES.sample} #{LAST_NAMES.sample[0]}."
            verified = rand < 0.7
            helpful = rating >= 4 ? rand(0..120) : rand(0..30)
            created = rand(730.days).seconds.ago

            "(" \
              "#{product_id}, #{rating}, " \
              "#{ActiveRecord::Base.connection.quote(title)}, " \
              "#{ActiveRecord::Base.connection.quote(comment)}, " \
              "#{ActiveRecord::Base.connection.quote(reviewer)}, " \
              "#{verified}, #{helpful}, " \
              "'#{created.to_fs(:db)}', '#{Time.current.to_fs(:db)}')"
          end.join(",\n")

          sql = <<~SQL
            INSERT INTO product_reviews
              (product_id, rating, title, comment, reviewer_name, verified_purchase, helpful_count, created_at, updated_at)
            VALUES #{values}
          SQL

          ActiveRecord::Base.connection.execute(sql)

          progress = ((prod_idx * batches + batch_num + 1) * 100.0 / (product_ids.size * batches)).round(1)
          print "\r  Progress: #{progress}%"
        end

        GC.start if prod_idx % 3 == 0
      end

      puts "\nProduct Reviews: #{format_number(ProductReview.count)}"
    end

    def update_cached_ratings
      puts "\nUpdating cached ratings..."
      Product.find_each(&:update_cached_rating!)
      puts "Done."
    end

    def weighted_rating
      # Distribution: 5★=45%, 4★=25%, 3★=15%, 2★=10%, 1★=5%
      r = rand
      if r < 0.45
        5
      elsif r < 0.70
        4
      elsif r < 0.85
        3
      elsif r < 0.95
        2
      else
        1
      end
    end

    def title_for_rating(rating)
      case rating
      when 5 then REVIEW_TITLES_5.sample
      when 4 then REVIEW_TITLES_4.sample
      when 3 then REVIEW_TITLES_3.sample
      when 2 then REVIEW_TITLES_2.sample
      else REVIEW_TITLES_1.sample
      end
    end

    def comment_for_rating(rating)
      REVIEW_COMMENTS[rating].sample
    end

    def format_number(num)
      num.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse
    end
  end
end

# frozen_string_literal: true

require "open-uri"
require "fileutils"
require "uri"
require_relative "../seed_images_map"

namespace :seed_images do
  desc "Pre-fetch every remote URL referenced by db/seed_scripts/*.rb to public/seed-images/products/. Idempotent."
  task prefetch: :environment do
    seed_files = Dir[Rails.root.join("db/seed_scripts/*.rb")]
    urls = seed_files.flat_map do |path|
      File.read(path).scan(%r{https?://[^\s'"]+\.unsplash\.com/[^\s'"]+})
    end.uniq

    # Use the real JPEG placeholder so the file's bytes match its `.jpg` extension.
    # An SVG saved with a `.jpg` extension renders fine via the <img> tag in
    # most browsers but Lighthouse/WebPageTest complain about MIME mismatch.
    placeholder_src = Rails.root.join("public/seed-images/placeholder.jpg")
    products_dir = Rails.root.join("public/seed-images/products")
    FileUtils.mkdir_p(products_dir)
    FileUtils.mkdir_p(placeholder_src.dirname)

    fetched = 0
    skipped = 0
    fallbacks = 0

    urls.each do |remote|
      local_rel = SeedImagesMap.local_path(remote)
      dest = SeedImagesMap.absolute_path(remote, Rails.root)
      if File.exist?(dest) && File.size(dest).positive?
        skipped += 1
        next
      end

      begin
        URI.parse(remote).open(read_timeout: 30) do |io|
          File.binwrite(dest, io.read)
        end
        fetched += 1
      rescue StandardError => e
        warn "  ! #{remote}: #{e.class}: #{e.message}"
        if File.exist?(placeholder_src)
          FileUtils.cp(placeholder_src, dest)
          fallbacks += 1
        end
      end
    end

    puts "[seed_images] prefetch: total=#{urls.size} fetched=#{fetched} skipped=#{skipped} fallback_placeholder=#{fallbacks}"
  end

  desc "Rewrite DB image_url / images columns from any remote URL to its mapped local path. Run after `db:seed`."
  task rewrite_db: :environment do
    rewritten_restaurants = 0
    Restaurant.where("image_url LIKE 'http%'").find_each(batch_size: 100) do |r|
      digest = Digest::SHA1.hexdigest(r.image_url)[0, 12]
      local = "/seed-images/restaurants/#{r.id}.jpg"
      local = "/seed-images/restaurants/picsum-#{digest}.jpg" unless File.exist?(Rails.root.join("public#{local}"))
      r.update_column(:image_url, local)
      rewritten_restaurants += 1
    end

    rewritten_products = 0
    Product.find_each(batch_size: 100) do |p|
      next if p.images.blank?
      changed = false
      new_images = p.images.map do |img|
        url = img.is_a?(Hash) ? (img["url"] || img[:url]) : img
        next img unless url.is_a?(String) && url.start_with?("http")

        local = SeedImagesMap.local_path(url)
        changed = true
        img.is_a?(Hash) ? img.merge("url" => local) : local
      end
      if changed
        p.update_column(:images, new_images)
        rewritten_products += 1
      end
    end

    puts "[seed_images] rewrite_db: restaurants=#{rewritten_restaurants} products=#{rewritten_products}"
  end

  desc "Pre-fetch + rewrite_db in one go."
  task localize: %i[prefetch rewrite_db]

  desc "Find any *.jpg in public/seed-images/ whose bytes are not a real JPEG (e.g. SVG saved with a .jpg extension)."
  task check_magic_bytes: :environment do
    bad = []
    Dir[Rails.root.join("public/seed-images/**/*.jpg")].each do |path|
      bytes = File.binread(path, 3)
      bad << path unless bytes && bytes.bytes == [0xFF, 0xD8, 0xFF]
    end
    if bad.empty?
      puts "[seed_images] check_magic_bytes: all .jpg files start with FF D8 FF (valid JPEG)."
    else
      puts "[seed_images] check_magic_bytes: #{bad.size} non-JPEG files"
      bad.each { |p| puts "  - #{p}" }
      abort
    end
  end

  desc "Verify every local seed image referenced by the DB exists and is non-empty."
  task verify: :environment do
    missing = []
    Restaurant.find_each do |r|
      path = r.image_url
      next unless path.to_s.start_with?("/seed-images/")
      full = Rails.root.join("public#{path}")
      missing << ["restaurant##{r.id}", path] unless File.exist?(full) && File.size(full).positive?
    end

    Product.find_each do |p|
      Array(p.images).each_with_index do |img, idx|
        url = img.is_a?(Hash) ? (img["url"] || img[:url]) : img
        next unless url.to_s.start_with?("/seed-images/")
        full = Rails.root.join("public#{url}")
        missing << ["product##{p.id} img##{idx}", url] unless File.exist?(full) && File.size(full).positive?
      end
    end

    if missing.empty?
      puts "[seed_images] verify: all referenced images exist and are non-empty."
    else
      puts "[seed_images] verify: #{missing.size} missing/empty entries"
      missing.each { |label, path| puts "  - #{label}: #{path}" }
      abort
    end
  end
end

# frozen_string_literal: true

require 'open-uri'
require 'fileutils'
require 'digest'
require 'uri'

namespace :seed_images do
  desc "Download remote restaurant + product images locally and rewrite DB URLs to /seed-images/..."
  task download: :environment do
    base_root = Rails.root.join('public', 'seed-images')
    FileUtils.mkdir_p(base_root.join('restaurants'))
    FileUtils.mkdir_p(base_root.join('products'))

    fetched = 0
    skipped = 0
    failed = 0

    fetch = lambda do |remote_url, dest_path|
      if File.exist?(dest_path)
        skipped += 1
        return true
      end
      begin
        URI.parse(remote_url).open(read_timeout: 30) do |io|
          File.binwrite(dest_path, io.read)
        end
        fetched += 1
        true
      rescue StandardError => e
        warn "  ! failed #{remote_url}: #{e.class}: #{e.message}"
        failed += 1
        false
      end
    end

    puts "[seed_images] Restaurants..."
    Restaurant.where("image_url LIKE 'http%'").find_each(batch_size: 50) do |r|
      filename = "#{r.id}.jpg"
      dest = base_root.join('restaurants', filename)
      if fetch.call(r.image_url, dest)
        local_path = "/seed-images/restaurants/#{filename}"
        r.update_column(:image_url, local_path)
      end
    end

    puts "[seed_images] Products..."
    Product.find_each(batch_size: 50) do |p|
      next if p.images.blank?

      changed = false
      new_images = p.images.map.with_index do |img, idx|
        url = img.is_a?(Hash) ? (img['url'] || img[:url]) : img
        next img unless url.is_a?(String) && url.start_with?('http')

        digest = Digest::SHA1.hexdigest(url)[0, 12]
        filename = "#{p.id}-#{idx}-#{digest}.jpg"
        dest = base_root.join('products', filename)
        if fetch.call(url, dest)
          local_url = "/seed-images/products/#{filename}"
          changed = true
          if img.is_a?(Hash)
            img.merge('url' => local_url)
          else
            local_url
          end
        else
          img
        end
      end

      p.update_column(:images, new_images) if changed
    end

    puts "[seed_images] done. fetched=#{fetched} skipped(existing)=#{skipped} failed=#{failed}"
  end
end

# frozen_string_literal: true

require 'digest'

# Stable mapping from a remote image URL to a local path under
# `public/seed-images/products/`. Used by:
#   - the seed scripts (so DB rows always point at a local path)
#   - the rake `seed_images:rewrite_db` task (to fix older DB rows
#     that were seeded before this mapping existed)
#
# Placing the mapping in one module avoids drift between the seed
# scripts and the rake task.
module SeedImagesMap
  PRODUCTS_DIR = "products"

  def self.local_path(remote_url)
    return remote_url if remote_url.nil? || remote_url.empty?
    return remote_url if remote_url.start_with?("/")

    digest = Digest::SHA1.hexdigest(remote_url)[0, 12]
    "/seed-images/#{PRODUCTS_DIR}/prod-#{digest}.jpg"
  end

  def self.absolute_path(remote_url, root)
    File.join(root, "public", local_path(remote_url).delete_prefix("/"))
  end

  def self.local?(value)
    value.is_a?(String) && value.start_with?("/seed-images/")
  end
end

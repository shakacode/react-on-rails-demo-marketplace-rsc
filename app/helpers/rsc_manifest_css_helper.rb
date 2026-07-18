# frozen_string_literal: true

# Resolves stylesheet assets emitted for React Server Components.
module RscManifestCssHelper
  RSC_MANIFEST_IMPLEMENTATION_DEFAULT = 'release'
  CLIENT_MANIFEST_PATH = Rails.root.join('public/packs/react-client-manifest.json')
  SERVER_MANIFEST_PATH = Rails.root.join('ssr-generated/react-server-client-manifest.json')
  STARTUP_EXTENSIONS = %w[.tsx .ts .jsx .js].freeze
  GENERATED_PACK_EXTENSIONS = %w[.js .jsx .ts .tsx].freeze
  SIMPLE_REEXPORT_RE = /^\s*export\s+\{\s*default\s*\}\s+from\s+["']([^"']+)["']/

  def current_rsc_build_implementation
    ENV.fetch('RSC_BUILD_IMPLEMENTATION', RSC_MANIFEST_IMPLEMENTATION_DEFAULT)
  end

  def append_rsc_server_component_manifest_css(component_name)
    hrefs = rsc_server_component_manifest_css(component_name)
    return false if hrefs.empty?

    content_for :head do
      safe_join(hrefs.map { |href| stylesheet_link_tag(href, media: 'all') }, "\n")
    end

    true
  end

  private

  def rsc_server_component_manifest_css(component_name)
    manifest_css = combined_rsc_server_component_css
    return [] if manifest_css.empty?

    manifest_key = server_component_manifest_keys(component_name).find { |key| manifest_css.key?(key) }
    return [] unless manifest_key

    Array(manifest_css[manifest_key]).compact.uniq
  end

  def combined_rsc_server_component_css
    @combined_rsc_server_component_css ||= begin
      manifests = [load_rsc_manifest(CLIENT_MANIFEST_PATH), load_rsc_manifest(SERVER_MANIFEST_PATH)]
      manifests.each_with_object({}) do |manifest, result|
        merge_server_component_css(manifest, result)
      end
    end
  end

  def merge_server_component_css(manifest, result)
    server_component_css = manifest['serverComponentCss']
    return unless server_component_css.is_a?(Hash)

    server_component_css.each do |key, hrefs|
      result[key] = Array(result[key]) | hrefs if hrefs.is_a?(Array)
    end
  end

  def load_rsc_manifest(pathname)
    return {} unless pathname.exist?

    JSON.parse(pathname.read)
  rescue JSON::ParserError
    {}
  end

  def server_component_manifest_keys(component_name)
    startup_file = startup_component_file(component_name)
    keys = []

    if startup_file
      keys.concat(resolved_startup_target_manifest_keys(startup_file))
      keys << manifest_key_for(startup_file)
    end

    keys.concat(generated_pack_manifest_keys(component_name))
    keys.uniq
  end

  def startup_component_file(component_name)
    STARTUP_EXTENSIONS.each do |extension|
      absolute_path = Rails.root.join("app/javascript/startup/#{component_name}#{extension}")
      return absolute_path if absolute_path.exist?
    end

    nil
  end

  def resolved_startup_target_manifest_keys(startup_file)
    match = startup_file.read.match(SIMPLE_REEXPORT_RE)
    return [] unless match

    resolved_path = resolve_relative_module_path(startup_file.dirname, match[1])
    return [] unless resolved_path

    [manifest_key_for(resolved_path)]
  end

  def resolve_relative_module_path(base_directory, specifier)
    return nil unless specifier.start_with?('.', '..')

    base_path = base_directory.join(specifier)
    candidates = [base_path]
    candidates.concat(STARTUP_EXTENSIONS.map { |extension| Pathname.new("#{base_path}#{extension}") })
    candidates.concat(STARTUP_EXTENSIONS.map { |extension| base_path.join("index#{extension}") })
    candidates.find(&:exist?)
  end

  def generated_pack_manifest_keys(component_name)
    GENERATED_PACK_EXTENSIONS.filter_map do |extension|
      absolute_path = Rails.root.join("app/javascript/packs/generated/#{component_name}#{extension}")
      next unless absolute_path.exist?

      manifest_key_for(absolute_path)
    end
  end

  def manifest_key_for(pathname)
    "file://#{pathname.realpath}"
  end
end

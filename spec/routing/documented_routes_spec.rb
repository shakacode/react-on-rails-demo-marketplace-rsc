# frozen_string_literal: true

require 'rails_helper'
require 'uri'

# Check the entry-point docs against the existing route inventory, without
# fetching the live site or starting the Node renderer.
RSpec.describe 'Documented demo routes', type: :routing do
  def app_url_path(url)
    uri = URI.parse(url.sub(/[),;:.]+\z/, ''))
    return unless %w[rsc.reactonrails.com localhost 127.0.0.1].include?(uri.host)

    uri.path.empty? ? '/' : uri.path
  end

  def documented_paths(markdown)
    urls = URI.extract(markdown, %w[http https]).filter_map { |url| app_url_path(url) }
    examples = markdown.scan(%r{`(/[^`\s]+)`}).flatten
    relative = markdown_links(markdown).select { |target| target.start_with?('/') }

    (urls + examples + relative).map { |path| path.split(/[?#]/).first }.uniq.sort
  end

  def markdown_links(markdown)
    markdown.scan(/\[[^\]]+\]\(([^)\s]+)\)/).flatten
  end

  def undocumented_paths(paths)
    paths.reject do |path|
      RouteContract.declared_specs.any? do |spec|
        pattern = Regexp.escape(spec).gsub(/:\w+/, '[^/]+')
        path.match?(Regexp.new("\\A#{pattern}\\z"))
      end
    end
  end

  it 'checks links, localhost commands and inline examples, including dynamic routes' do
    markdown = <<~MD
      [Restaurant](https://rsc.reactonrails.com/restaurant/1/rsc?count=10#reviews)
      [Gallery](https://rsc.reactonrails.com/media-gallery): a demo.
      [Product](/product/rsc?tab=reviews)
      curl http://localhost:3000/api/product_search/results
      `/product-search/rsc` and `/route-that-does-not-exist`
    MD

    expect(documented_paths(markdown)).to contain_exactly(
      '/restaurant/1/rsc', '/api/product_search/results', '/media-gallery', '/product/rsc',
      '/product-search/rsc', '/route-that-does-not-exist'
    )
    expect(undocumented_paths(documented_paths(markdown))).to eq(['/route-that-does-not-exist'])
  end

  %w[README.md CONTRIBUTING.md].each do |filename|
    describe filename do
      let(:markdown) { Rails.root.join(filename).read }

      it 'documents only routes in the canonical GET route contract' do
        paths = documented_paths(markdown)
        unknown = undocumented_paths(paths)

        expect(paths).not_to be_empty
        expect(unknown).to be_empty, "#{filename} documents unknown routes: #{unknown.join(', ')}"
      end

      it 'links to existing local files' do
        targets = markdown_links(markdown)
        local = targets.reject { |target| URI.parse(target).absolute? || target.start_with?('#', '/') }
        missing = local.reject { |target| Rails.root.join(target.split('#').first).exist? }

        expect(missing).to be_empty, "#{filename} links to missing files: #{missing.join(', ')}"
      end

      it 'references existing executable entry points' do
        commands = markdown.scan(%r{(?<![\w/])((?:\./)?(?:bin|script)/[\w/-]+)}).flatten.uniq
        missing = commands.reject { |command| Rails.root.join(command).executable? }

        expect(missing).to be_empty, "#{filename} references missing executables: #{missing.join(', ')}"
      end
    end
  end
end

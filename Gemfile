source 'https://rubygems.org'

ruby '3.3.0'

# Fix connection_pool compatibility with Ruby 3.3
gem 'connection_pool', '~> 2.4'

# Core Rails
gem 'rails', '~> 7.1'
gem 'pg', '~> 1.5'
gem 'puma', '~> 6.0'

# Asset Pipeline
gem 'sprockets-rails'
gem 'importmap-rails'
gem 'turbo-rails'
gem 'stimulus-rails'

# React on Rails (async-http transport branch)
gem 'react_on_rails', git: 'https://github.com/shakacode/react_on_rails.git',
                       branch: 'feat/async-http-with-async-props',
                       glob: 'react_on_rails/*.gemspec'
gem 'react_on_rails_pro', git: 'https://github.com/shakacode/react_on_rails.git',
                            branch: 'feat/async-http-with-async-props',
                            glob: 'react_on_rails_pro/*.gemspec'

# Shakapacker for webpack integration
gem 'shakapacker', '~> 9.5'

# JSON handling
gem 'jbuilder'

# Windows compatibility
gem 'tzinfo-data', platforms: %i[windows jruby]

# Performance
gem 'bootsnap', require: false

group :development, :test do
  gem 'debug', platforms: %i[mri windows]
  gem 'rspec-rails', '~> 6.1'
  gem 'factory_bot_rails'
  gem 'faker'
  gem "pry", "~> 0.16.0"
  gem "pry-byebug", "~> 3.12"
end

group :development do
  gem 'web-console'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
  gem 'rubocop-rspec', require: false
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
end

source 'https://rubygems.org'

ruby '3.4.6'

# Core Rails
gem 'rails', '~> 8.1'
gem 'pg', '~> 1.6'
gem 'puma', '~> 8.0'

# Asset Pipeline
gem 'sprockets-rails'
gem 'importmap-rails'
gem 'turbo-rails'
gem 'stimulus-rails'

# React on Rails
gem 'react_on_rails', '17.0.1'
gem 'react_on_rails_pro', '17.0.1'

# Shakapacker for webpack integration
gem 'shakapacker', '10.3.2'

# JSON handling
gem 'jbuilder'

# Windows compatibility
gem 'tzinfo-data', platforms: %i[windows jruby]

# Performance
gem 'bootsnap', require: false

group :development, :test do
  gem 'debug', platforms: %i[mri windows]
  gem 'rspec-rails', '~> 8.0'
  gem 'factory_bot_rails'
  gem 'faker'
  gem "pry", "~> 0.16.0"
  gem "pry-byebug", "~> 3.12"
end

group :development do
  gem 'web-console'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
end

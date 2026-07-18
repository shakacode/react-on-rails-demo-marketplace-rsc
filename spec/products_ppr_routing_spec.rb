ENV["RAILS_ENV"] ||= "test"

require_relative "../config/environment"
require "rspec/rails"

RSpec.describe ProductsController, type: :routing do
  it "routes /product/ppr to the experimental PPR action" do
    expect(get: "/product/ppr").to route_to("products#show_ppr")
  end
end

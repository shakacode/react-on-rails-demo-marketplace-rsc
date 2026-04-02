# frozen_string_literal: true

class HomeController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:rsc]

  def index; end

  def rsc
    stream_view_containing_react_components(template: "/home/rsc")
  end
end

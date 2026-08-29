# frozen_string_literal: true

require 'rails_helper'

# The ?count/?initial experiment knobs on the virtualized restaurant routes
# (issue #184) are measurement-only: RestaurantsController honors them solely
# when the server was started with ENABLE_BENCH_PARAMS=1 (the documented
# benchmark flow), so the public deployment always serves the default page.
# The renderer stub keeps the real controller and data assembly in play; what
# reaches RestaurantDetailData — and what lands in the component props — is
# the observable contract.
RSpec.describe 'Restaurant bench params gate', type: :request, renderer_stub: true do
  let!(:restaurant) { create_restaurant }

  def arm_bench_params
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with(RestaurantsController::BENCH_PARAMS_ENV).and_return('1')
  end

  # The renderer stub swallows helper arguments, so capture the props the view
  # hands to react_component to observe the virtualization knobs.
  def capture_component_props
    captured = nil
    allow_any_instance_of(RestaurantsController.view_context_class)
      .to receive(:react_component) do |_view, *_args, **kwargs|
        captured = kwargs[:props]
        RendererStub::COMPONENT_HTML
      end
    -> { captured }
  end

  it 'renders both virtualized variants' do
    get "/restaurant/#{restaurant.id}/ssr-virtual"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('data-renderer-stub="true"')

    get "/restaurant/#{restaurant.id}/rsc-virtual"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('data-renderer-stub="true"')
  end

  context 'without ENABLE_BENCH_PARAMS' do
    it 'ignores ?count and assembles the default review count' do
      expect(RestaurantDetailData).to receive(:for)
        .with(an_instance_of(Restaurant), reviews_count: RestaurantDetailData::DEFAULT_REVIEWS_COUNT)
        .and_call_original

      get "/restaurant/#{restaurant.id}/ssr-virtual?count=500"

      expect(response).to have_http_status(:ok)
    end

    it 'ignores ?initial and keeps the default server-rendered rows' do
      props = capture_component_props

      get "/restaurant/#{restaurant.id}/ssr-virtual?initial=0"

      expect(response).to have_http_status(:ok)
      expect(props.call[:virtualization]).to eq(initial_rows: RestaurantsController::DEFAULT_INITIAL_ROWS)
    end
  end

  context 'with ENABLE_BENCH_PARAMS=1' do
    before { arm_bench_params }

    it 'honors ?count' do
      expect(RestaurantDetailData).to receive(:for)
        .with(an_instance_of(Restaurant), reviews_count: 123)
        .and_call_original

      get "/restaurant/#{restaurant.id}/rsc-virtual?count=123"

      expect(response).to have_http_status(:ok)
    end

    it 'clamps ?count to the maximum' do
      expect(RestaurantDetailData).to receive(:for)
        .with(an_instance_of(Restaurant), reviews_count: RestaurantsController::MAX_REVIEWS_COUNT)
        .and_call_original

      get "/restaurant/#{restaurant.id}/ssr-virtual?count=99999"

      expect(response).to have_http_status(:ok)
    end

    it 'honors and clamps ?initial' do
      props = capture_component_props

      get "/restaurant/#{restaurant.id}/ssr-virtual?initial=0"
      expect(props.call[:virtualization]).to eq(initial_rows: 0)

      get "/restaurant/#{restaurant.id}/ssr-virtual?initial=999"
      expect(props.call[:virtualization]).to eq(initial_rows: RestaurantsController::MAX_INITIAL_ROWS)
    end

    it 'never 500s on array-form params and falls back to the defaults' do
      expect(RestaurantDetailData).to receive(:for)
        .with(an_instance_of(Restaurant), reviews_count: RestaurantDetailData::DEFAULT_REVIEWS_COUNT)
        .and_call_original

      get "/restaurant/#{restaurant.id}/ssr-virtual?count[]=1&initial[]=2"

      expect(response).to have_http_status(:ok)
    end
  end
end

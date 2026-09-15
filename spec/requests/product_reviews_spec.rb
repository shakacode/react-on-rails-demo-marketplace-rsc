# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'ProductReviews', type: :request do
  let(:product) { create_product_with_reviews }

  let(:valid_params) do
    {
      review: {
        rating: 5,
        title: 'Posted by the spike',
        comment: 'Canned review used to demonstrate RSC read-your-writes.',
        reviewer_name: 'Spike Bot',
        verified_purchase: true,
        helpful_count: 500
      }
    }
  end

  describe 'POST /products/:product_id/reviews' do
    it 'creates the review and responds 201 with the new id as JSON' do
      expect do
        post "/products/#{product.id}/reviews", params: valid_params, as: :json
      end.to change(product.product_reviews, :count).by(1)

      expect(response).to have_http_status(:created)
      review = ProductReview.find(response.parsed_body.fetch('id'))
      expect(review.reviewer_name).to eq('Spike Bot')
      expect(review.helpful_count).to eq(500)
      expect(review.verified_purchase).to be(true)
    end

    it 'makes the new review visible to the emit-block query the RSC page streams from' do
      post "/products/#{product.id}/reviews", params: valid_params, as: :json

      expect(response).to have_http_status(:created)
      # helpful_count 500 beats the TestData reviews (10..8), so read-your-writes
      # is observable through the same top_reviews(5) query both render doors use.
      expect(product.top_reviews(5).map(&:reviewer_name)).to include('Spike Bot')
    end

    it 'responds 422 with the FormResponders {errors: {field: [...]}} shape on invalid input' do
      post "/products/#{product.id}/reviews",
           params: { review: { rating: nil, title: 'No rating' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      body = response.parsed_body
      expect(body).to have_key('errors')
      expect(body['errors']).to include('rating', 'reviewer_name')
      expect(body['errors']['rating']).to be_an(Array)
      expect(body['errors']['rating']).not_to be_empty
    end

    it 'responds 404 for an unknown product id' do
      post '/products/0/reviews', params: valid_params, as: :json
      expect(response).to have_http_status(:not_found)
    end

    context 'with forgery protection enabled (as in development/production)' do
      around do |example|
        ActionController::Base.allow_forgery_protection = true
        example.run
      ensure
        ActionController::Base.allow_forgery_protection = false
      end

      it 'rejects a POST that carries no CSRF token' do
        url = "/products/#{product.id}/reviews" # materialize the product before measuring the count

        expect do
          post url, params: valid_params, as: :json
        end.not_to change(ProductReview, :count)

        # InvalidAuthenticityToken is rescuable → 422 under
        # config.action_dispatch.show_exceptions = :rescuable.
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  # The refetch door (issue #245): RSCRoute.refetch() GETs
  # /rsc_payload/ProductPageRSC?props=..., served by the gem's
  # RscPayloadController through the app's template override
  # (app/views/react_on_rails_pro/rsc_payload.text.erb). The real NDJSON
  # streaming needs the Node renderer, so — like spec/support/renderer_stub.rb
  # does for the page routes — this stubs only the process-boundary helpers and
  # asserts the override dispatches through the async-props helper with the
  # shared ProductRscProps emit block staffed. Stock-template behavior (the
  # config-1 crash) is browser-verified in tmp/spike-245-evidence/config1-stock.
  describe 'GET /rsc_payload/:component_name (app template override)' do
    let(:emitted) { {} }
    let(:recorded_async_options) { {} }
    # The app-level subclass (RscPayloadController) serves the route since the
    # issue #245 hardening; stub the process-boundary helpers on it directly.
    let(:payload_view_context) { RscPayloadController.view_context_class }

    before do
      allow_any_instance_of(RscPayloadController)
        .to receive(:stream_view_containing_react_components) do |controller, **kwargs|
          controller.render(template: kwargs.fetch(:template), layout: false, formats: [:text])
        end

      recorder = emitted
      options_recorder = recorded_async_options
      allow_any_instance_of(payload_view_context)
        .to receive(:rsc_payload_react_component_with_async_props) do |_view, name, options = {}, &block|
          options_recorder.replace(options)
          block&.call(->(prop_name, value) { recorder[prop_name] = value })
          "async-props-payload-stub:#{name}"
        end
      allow_any_instance_of(payload_view_context)
        .to receive(:rsc_payload_react_component) do |_view, name, _options = {}|
          "plain-payload-stub:#{name}"
        end
    end

    def get_payload(component_name, props)
      get "/rsc_payload/#{component_name}", params: { props: props.to_json }
    end

    it 'routes ProductPageRSC through the async-props helper with the shared emit block staffed' do
      get_payload('ProductPageRSC', { product: { id: product.id } })

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('async-props-payload-stub:ProductPageRSC')
      expect(emitted.keys).to eq(%w[product_details review_stats reviews related_products])
      expect(emitted['reviews'][:reviews].map { |r| r[:reviewer_name] }).to include('Reviewer 1')
      expect(emitted['review_stats'][:total_reviews]).to eq(3)
    end

    it 'reflects a just-written review through the same door refetch uses (read your writes)' do
      post "/products/#{product.id}/reviews", params: valid_params, as: :json
      expect(response).to have_http_status(:created)

      get_payload('ProductPageRSC', { product: { id: product.id } })

      expect(emitted['reviews'][:reviews].map { |r| r[:reviewer_name] }).to include('Spike Bot')
    end

    it 'rebuilds the initial props server-side instead of echoing the browser copy' do
      get_payload('ProductPageRSC', { product: { id: product.id, name: 'SPOOFED', price: 0 } })

      expect(response).to have_http_status(:ok)
      sent = recorded_async_options.fetch(:props).fetch(:product)
      expect(sent[:name]).to eq(product.name) # not 'SPOOFED'
      expect(sent[:sku]).to eq(product.sku)   # full shape restored (buildProductSpecMarkdown needs it)
      # Async-streamed fields stay out of the initial props, mirroring door #1.
      expect(sent).not_to have_key(:description)
    end

    it 'responds 404 before emitting anything when the browser props carry no known product id' do
      get_payload('ProductPageRSC', {})
      expect(response).to have_http_status(:not_found)

      get_payload('ProductPageRSC', { product: { id: 0 } })
      expect(response).to have_http_status(:not_found)
      expect(emitted).to be_empty
    end

    it 'keeps the stock plain-props path for components without an async-props block' do
      get_payload('SimpleServerComponent', {})

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('plain-payload-stub:SimpleServerComponent')
      expect(emitted).to be_empty
    end
  end
end

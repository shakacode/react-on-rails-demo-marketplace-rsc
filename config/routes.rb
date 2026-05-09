Rails.application.routes.draw do
  rsc_payload_route
  repository_url = 'https://github.com/shakacode/react-server-components-marketplace-demo'
  contributing_url = "#{repository_url}/blob/main/CONTRIBUTING.md"
  issues_url = "#{repository_url}/issues"

  # Health check endpoint
  get 'up' => 'rails/health#show', as: :rails_health_check

  root 'home#index'
  get '/source', to: redirect(repository_url, status: 308), as: :source_code
  get '/contributing', to: redirect(contributing_url, status: 308), as: :contributing_guide
  get '/issues', to: redirect(issues_url, status: 308), as: :project_issues
  get '/search-performance' => 'pages#search_performance'
  get '/rsc' => 'home#rsc'
  get '/why-rsc' => 'pages#why_rsc'
  get '/measure' => 'pages#measure'
  get '/lh-compare' => 'pages#lh_compare', as: :lh_compare

  # Restaurant detail page — three versions for the markdown-heavy detail view
  get '/restaurant/:id/ssr', to: 'restaurants#show_ssr', as: :restaurant_show_ssr
  get '/restaurant/:id/client', to: 'restaurants#show_client', as: :restaurant_show_client
  get '/restaurant/:id/rsc', to: 'restaurants#show_rsc', as: :restaurant_show_rsc

  # Product page routes — three versions demonstrating e-commerce RSC gains
  get '/product/ssr', to: 'products#show_ssr'        # V1: All data fetched on server, returned at once
  get '/product/client', to: 'products#show_client'   # V2: Loadable components, client-side fetch
  get '/product/rsc', to: 'products#show_rsc'         # V3: RSC streaming

  # Product search results — three versions demonstrating search page RSC gains
  get '/product-search/ssr', to: 'product_search#search_ssr'       # V1: Full SSR
  get '/product-search/client', to: 'product_search#search_client'  # V2: Client-side search
  get '/product-search/rsc', to: 'product_search#search_rsc'        # V3: RSC streaming

  # Blog post routes — three versions demonstrating bundle size differences
  get '/blog/ssr', to: 'blog#post_ssr'       # V1: marked + highlight.js shipped to client
  get '/blog/client', to: 'blog#post_client'  # V2: Libraries loaded in async chunk
  get '/blog/rsc', to: 'blog#post_rsc'              # V3: Libraries stay server-side + streaming
  get '/blog/rsc-simple', to: 'blog#post_rsc_simple' # V4: Libraries stay server-side, all data upfront

  # RSC debug steps (incremental complexity)
  get '/blog/rsc-step1', to: 'blog#post_rsc_step1'
  get '/blog/rsc-step1b', to: 'blog#post_rsc_step1b'
  get '/blog/rsc-step1c', to: 'blog#post_rsc_step1c'
  get '/blog/rsc-step2', to: 'blog#post_rsc_step2'
  get '/blog/rsc-step3', to: 'blog#post_rsc_step3'
  get '/blog/rsc-step4', to: 'blog#post_rsc_step4'
  get '/blog/rsc-step5', to: 'blog#post_rsc_step5'


  # API endpoints (Task 2)
  namespace :api do
    resources :restaurants, only: [] do
      member do
        # Used by /restaurant/:id/client variant
        get :detail
      end
    end

    resources :products, only: [] do
      member do
        get :reviews
        get :review_stats
        get :related_products
      end
    end

    # Product search API (for V2 client version)
    get 'product_search/results', to: 'product_search#results'
    get 'product_search/facets', to: 'product_search#facets'
    post 'product_search/review_snippets', to: 'product_search#review_snippets'

    resources :blog_posts, only: [] do
      member do
        get :related_posts
      end
    end

    # Performance metrics collection
    post '/performance_metrics', to: 'performance_metrics#create'
  end
end

Rails.application.routes.draw do
  rsc_payload_route
  repository_url = ApplicationHelper::GITHUB_REPO_URL
  contributing_url = "#{repository_url}/blob/main/CONTRIBUTING.md"
  issues_url = "#{repository_url}/issues"

  # Health check endpoint
  get 'up' => 'rails/health#show', as: :rails_health_check

  root 'home#index'
  get '/source', to: redirect(repository_url, status: 308), as: :source_code
  get '/contributing', to: redirect(contributing_url, status: 308), as: :contributing_guide
  get '/issues', to: redirect(issues_url, status: 308), as: :project_issues
  get '/rsc-performance' => 'pages#rsc_performance'
  # Old slug kept as a permanent (308) redirect so existing links/SEO equity survive the rename.
  get '/search-performance', to: redirect('/rsc-performance', status: 308)
  get '/rsc' => 'home#rsc'
  get '/why-rsc' => 'pages#why_rsc'
  get '/how-rsc-works' => 'pages#how_rsc_works'
  get '/measure' => 'pages#measure'
  get '/lh-compare' => 'pages#lh_compare', as: :lh_compare
  get '/ssr-rsc-playground' => 'pages#ssr_rsc_playground'
  get '/products', to: 'product_search#search_rsc', as: :products

  # Multimedia showcase — media-heavy page (HLS video + responsive image galleries).
  # RSC-first single page (issue #98). Both paths hit the same RSC action.
  get '/media-gallery', to: 'media_gallery#show_rsc', as: :media_gallery
  get '/media-gallery/rsc', to: 'media_gallery#show_rsc'

  # Restaurant detail page — three versions for the markdown-heavy detail view
  get '/restaurant/:id/ssr', to: 'restaurants#show_ssr', as: :restaurant_show_ssr
  get '/restaurant/:id/ssr-cached', to: 'restaurants#show_ssr_cached' # SSR + cached_react_component
  get '/restaurant/:id/client', to: 'restaurants#show_client', as: :restaurant_show_client
  get '/restaurant/:id/rsc', to: 'restaurants#show_rsc', as: :restaurant_show_rsc
  get '/restaurant/:id/rsc-cached', to: 'restaurants#show_rsc_cached' # RSC + cached_stream_react_component

  # Product page routes — three versions demonstrating e-commerce RSC gains
  get '/product/ssr', to: 'products#show_ssr'        # V1: All data fetched on server, returned at once
  get '/product/ssr-cached', to: 'products#show_ssr_cached' # V1 + cached_react_component
  get '/product/client', to: 'products#show_client'   # V2: Loadable components, client-side fetch
  get '/product/rsc', to: 'products#show_rsc'         # V3: RSC streaming
  get '/product/rsc-cached', to: 'products#show_rsc_cached' # V3 + cached_stream_react_component_with_async_props
  get '/product/ppr', to: 'products#show_ppr'         # Experimental cached shell + live holes

  # Product search results — three versions demonstrating search page RSC gains
  get '/product-search/ssr', to: 'product_search#search_ssr'       # V1: Full SSR
  get '/product-search/ssr-cached', to: 'product_search#search_ssr_cached' # V1 + cached_react_component
  get '/product-search/client', to: 'product_search#search_client'  # V2: Client-side search
  get '/product-search/rsc', to: 'product_search#search_rsc'        # V3: RSC streaming
  get '/product-search/rsc-cached', to: 'product_search#search_rsc_cached' # V3 + cached stream w/ async props

  # Blog post routes — three versions demonstrating bundle size differences
  get '/blog/ssr', to: 'blog#post_ssr'       # V1: marked + highlight.js shipped to client
  get '/blog/ssr-cached', to: 'blog#post_ssr_cached' # V1 + cached_react_component
  get '/blog/client', to: 'blog#post_client'  # V2: Libraries loaded in async chunk
  get '/blog/rsc', to: 'blog#post_rsc'              # V3: Libraries stay server-side + streaming
  get '/blog/rsc-cached', to: 'blog#post_rsc_cached' # V3 + cache (cached_stream_react_component_with_async_props)
  get '/blog/rsc-simple', to: 'blog#post_rsc_simple' # V4: Libraries stay server-side, all data upfront
  get '/blog/rsc-simple-cached', to: 'blog#post_rsc_simple_cached' # V4 + cached_stream_react_component

  # RSC debug steps (incremental complexity)
  get '/blog/rsc-step1', to: 'blog#post_rsc_step1'
  get '/blog/rsc-step1b', to: 'blog#post_rsc_step1b'
  get '/blog/rsc-step1c', to: 'blog#post_rsc_step1c'
  get '/blog/rsc-step2', to: 'blog#post_rsc_step2'
  get '/blog/rsc-step3', to: 'blog#post_rsc_step3'
  get '/blog/rsc-step4', to: 'blog#post_rsc_step4'
  get '/blog/rsc-step5', to: 'blog#post_rsc_step5'

  # CSS code-splitting experiment — per-page big CSS files, cssShared shared across pages.
  # one = Shared + A, two = Shared + B. Three rendering shapes: ssr / rsc-server / rsc-client.
  get '/css-demo/one/ssr', to: 'css_demo#one_ssr'
  get '/css-demo/two/ssr', to: 'css_demo#two_ssr'
  get '/css-demo/one/rsc-server', to: 'css_demo#one_rsc_server'
  get '/css-demo/two/rsc-server', to: 'css_demo#two_rsc_server'
  get '/css-demo/one/rsc-client', to: 'css_demo#one_rsc_client'
  get '/css-demo/two/rsc-client', to: 'css_demo#two_rsc_client'

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

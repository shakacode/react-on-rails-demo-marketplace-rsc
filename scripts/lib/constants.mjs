export const DEFAULTS = {
  iterations: 7,
  warmup: 2,
  timeout: 30_000,
  baseUrl: 'http://localhost:3000',
};

export const PAGES = {
  ssr: { path: '/blog/ssr', label: 'SSR (V1)', hasStreaming: false },
  client: { path: '/blog/client', label: 'Client (V2)', hasStreaming: false },
  rsc: { path: '/blog/rsc', label: 'RSC (V3)', hasStreaming: true },
  'product-ssr': { path: '/product/ssr', label: 'Product SSR', hasStreaming: false, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'product-client': { path: '/product/client', label: 'Product Client', hasStreaming: false, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'product-rsc': { path: '/product/rsc', label: 'Product RSC', hasStreaming: true, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'search-ssr': { path: '/product-search/ssr', label: 'Search SSR', hasStreaming: false },
  'search-client': { path: '/product-search/client', label: 'Search Client', hasStreaming: false },
  'search-rsc': { path: '/product-search/rsc', label: 'Search RSC', hasStreaming: true },
  'dashboard-ssr': { path: '/analytics/ssr', label: 'Dashboard SSR', hasStreaming: false },
  'dashboard-client': { path: '/analytics/client', label: 'Dashboard Client', hasStreaming: false },
  'dashboard-rsc': { path: '/analytics/rsc', label: 'Dashboard RSC', hasStreaming: true },
  // Cached variants (issue #97) — fragment-cached siblings of the SSR/RSC pages above.
  'ssr-cached': { path: '/blog/ssr-cached', label: 'SSR cached', hasStreaming: false },
  'rsc-cached': { path: '/blog/rsc-cached', label: 'RSC cached', hasStreaming: true },
  'product-ssr-cached': { path: '/product/ssr-cached', label: 'Product SSR cached', hasStreaming: false, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'product-rsc-cached': { path: '/product/rsc-cached', label: 'Product RSC cached', hasStreaming: true, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'product-rsc-pull': { path: '/product/rsc-pull', label: 'Product RSC Pull', hasStreaming: true, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'product-ppr': { path: '/product/ppr', label: 'Product PPR', hasStreaming: true, selectors: { likeButton: 'button', relatedHeadingText: 'Customers Also Viewed' } },
  'search-ssr-cached': { path: '/product-search/ssr-cached', label: 'Search SSR cached', hasStreaming: false },
  'search-rsc-cached': { path: '/product-search/rsc-cached', label: 'Search RSC cached', hasStreaming: true },
};

export const SELECTORS = {
  likeButton: 'section button',
  relatedPostsHeading: 'h2',
  relatedPostsText: 'Related Posts',
};

export const THROTTLE = {
  cpu: 4,
  network: {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps
    latency: 150,
  },
};

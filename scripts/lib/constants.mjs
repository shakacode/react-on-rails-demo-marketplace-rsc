export const DEFAULTS = {
  iterations: 7,
  warmup: 2,
  timeout: 30_000,
  baseUrl: 'http://localhost:3000',
};

// Shared selector set for the restaurant lanes. hydrationTarget must exist at
// load on every variant (the Helpful buttons may be virtualized away);
// interactionAnchorText is the h2 scrolled into view before the INP click.
const RESTAURANT_SELECTORS = {
  likeButton: 'button[data-benchmark-id="review-helpful"]',
  hydrationTarget: 'h1',
  relatedHeadingText: 'Reviews',
  interactionAnchorText: 'Reviews',
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
  // Restaurant detail lanes (issue #184) — the review-list virtualization experiment.
  // `scroll: true` opts a lane into the scripted scroll cycle plus DOM-node and
  // JS-heap sampling. The explicit likeButton selector makes a missing
  // interaction target a hard error for these lanes (INP cannot see scrolling,
  // so the discrete Helpful click is the only INP source). interactionAnchorText
  // names the h2 scrolled into view before the click — on the virtualized lanes
  // the button only exists once Virtuoso mounts the row.
  'restaurant-ssr': { path: '/restaurant/1/ssr', label: 'Restaurant SSR', hasStreaming: false, scroll: true, selectors: RESTAURANT_SELECTORS },
  'restaurant-client': { path: '/restaurant/1/client', label: 'Restaurant Client', hasStreaming: false, scroll: true, selectors: RESTAURANT_SELECTORS },
  'restaurant-rsc': { path: '/restaurant/1/rsc', label: 'Restaurant RSC', hasStreaming: true, scroll: true, selectors: RESTAURANT_SELECTORS },
  'restaurant-ssr-virtual': { path: '/restaurant/1/ssr-virtual', label: 'Restaurant SSR virtual', hasStreaming: false, scroll: true, selectors: RESTAURANT_SELECTORS },
  'restaurant-rsc-virtual': { path: '/restaurant/1/rsc-virtual', label: 'Restaurant RSC virtual', hasStreaming: true, scroll: true, selectors: RESTAURANT_SELECTORS },
};

export const SELECTORS = {
  likeButton: 'section button',
  relatedPostsHeading: 'h2',
  relatedPostsText: 'Related Posts',
};

// --mobile emulation profile: a mid-size phone viewport. The restaurant
// review grid collapses to one column below the md: breakpoint, which is the
// layout the virtualization experiment needs to cover (row heights differ
// ~2x between breakpoints).
export const MOBILE = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
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

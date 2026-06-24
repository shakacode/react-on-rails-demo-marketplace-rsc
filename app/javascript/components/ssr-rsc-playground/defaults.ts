import type { NetworkPreset, NetworkProfile, Section, SimulationParams } from './types';

export const SECTIONS: Section[] = [
  { id: 'header', label: 'Restaurant Header', kind: 'static' },
  { id: 'menu', label: 'Menu & Prices', kind: 'static' },
  { id: 'cart', label: 'Cart Widget', kind: 'dynamic' },
  { id: 'availability', label: 'Live Availability', kind: 'dynamic' },
  { id: 'delivery', label: 'Delivery Estimate', kind: 'dynamic' },
  { id: 'reviews', label: 'Reviews', kind: 'dynamic' },
  { id: 'recommendations', label: 'Personalized Picks', kind: 'dynamic' },
];

export const MODEL = {
  headerHtmlKb: 8,
  menuItemHtmlKb: 1.2,
  dynamicSectionFallbackKb: 0.4,

  ssrBaseBundleKb: 145,
  ssrMenuJsPerItemKb: 0.3,
  ssrLoadableChunkKb: 18,
  ssrMarkdownLibsKb: 95,
  ssrHydrationBaseMs: 80,
  ssrHydrationPerItemMs: 3.5,
  ssrHydrationPerKbMs: 0.4,
  ssrCacheHitMs: 2,
  ssrLazyChunkBaseKb: 12,
  ssrClientFetchBaseMs: 120,
  ssrClientFetchPerSectionMs: 40,
  ssrLazyRenderMs: 25,

  rscShellHtmlKb: 4,
  rscBaseBundleKb: 32,
  rscInteractiveIslandKb: 6,
  rscShellCacheHitMs: 2,
  rscStreamBaseMs: 40,
  rscStreamPerSectionMs: 55,
  rscStreamOverlapFactor: 0.5,
  rscSectionHtmlKb: 3,
  rscSelectiveHydrationMs: 12,
  rscEdgeRttMs: 5,
} as const;

export const NETWORK_PROFILES: Record<NetworkPreset, NetworkProfile> = {
  wifi: { rttMs: 10, kbPerMs: 6.25, label: 'WiFi' },
  fast4g: { rttMs: 50, kbPerMs: 1.88, label: 'Fast 4G' },
  slow4g: { rttMs: 100, kbPerMs: 0.5, label: 'Slow 4G' },
  slow3g: { rttMs: 200, kbPerMs: 0.05, label: 'Slow 3G' },
};

export const DEFAULT_PARAMS: SimulationParams = {
  menuItems: 40,
  networkPreset: 'fast4g',
};

export const COLORS = {
  cache: '#8b5cf6',
  server: '#6366f1',
  htmlDownload: '#3b82f6',
  jsDownload: '#06b6d4',
  hydration: '#f59e0b',
  lazyChunk: '#10b981',
  clientFetch: '#ef4444',
  lazyRender: '#84cc16',
  rscShell: '#8b5cf6',
  rscStream: '#3b82f6',
  rscHydration: '#10b981',
  rscEdge: '#6366f1',
  milestone: '#ef4444',
} as const;

export const MILESTONE_COLORS = {
  fcp: '#3b82f6',
  fallbacks: '#f59e0b',
  firstInteractive: '#10b981',
  fullyLoaded: '#8b5cf6',
} as const;

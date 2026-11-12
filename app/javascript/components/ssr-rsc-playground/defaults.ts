import type { NetworkPreset, NetworkProfile, PageSection, SimulationParams } from './types';

export const NETWORK_PROFILES: Record<NetworkPreset, NetworkProfile> = {
  wifi: { rttMs: 10, bandwidthKbMs: 6.25, label: 'WiFi' },
  fast4g: { rttMs: 50, bandwidthKbMs: 1.88, label: 'Fast 4G' },
  slow4g: { rttMs: 100, bandwidthKbMs: 0.50, label: 'Slow 4G' },
  slow3g: { rttMs: 200, bandwidthKbMs: 0.05, label: 'Slow 3G' },
};

export const BASE_SECTIONS: PageSection[] = [
  { id: 'header', label: 'Header & Nav', kind: 'static', cssKb: 8, totalJsKb: 12, clientJsKb: 0, propsKb: 2, htmlKb: 4 },
  { id: 'menu', label: 'Menu Grid', kind: 'static', cssKb: 15, totalJsKb: 45, clientJsKb: 8, propsKb: 30, htmlKb: 50 },
  { id: 'cart', label: 'Cart Widget', kind: 'dynamic', cssKb: 8, totalJsKb: 35, clientJsKb: 20, propsKb: 8, htmlKb: 6 },
  { id: 'delivery', label: 'Delivery Info', kind: 'dynamic', cssKb: 12, totalJsKb: 40, clientJsKb: 15, propsKb: 10, htmlKb: 8 },
  { id: 'reviews', label: 'Reviews', kind: 'static', cssKb: 10, totalJsKb: 25, clientJsKb: 3, propsKb: 20, htmlKb: 30 },
  { id: 'recommendations', label: 'For You', kind: 'dynamic', cssKb: 10, totalJsKb: 30, clientJsKb: 12, propsKb: 15, htmlKb: 20 },
];

export const LOYALTY_SECTION: PageSection = {
  id: 'loyalty',
  label: 'Loyalty Rewards',
  kind: 'dynamic',
  cssKb: 10,
  totalJsKb: 28,
  clientJsKb: 10,
  propsKb: 12,
  htmlKb: 15,
};

export const DEFAULT_PARAMS: SimulationParams = {
  networkPreset: 'fast4g',
  sections: BASE_SECTIONS,
};

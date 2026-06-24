export type NetworkPreset = 'wifi' | 'fast4g' | 'slow4g' | 'slow3g';

export interface NetworkProfile {
  rttMs: number;
  kbPerMs: number;
  label: string;
}

export interface SimulationParams {
  menuItems: number;
  networkPreset: NetworkPreset;
}

export interface Section {
  id: string;
  label: string;
  kind: 'static' | 'dynamic';
}

export interface Segment {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  color: string;
  row: number;
  category: 'cache' | 'server' | 'network' | 'browser' | 'deferred';
}

export type ConnectorType = 'eliminated' | 'overlapped' | 'streamed';

export interface Connector {
  id: string;
  fromSegmentId: string;
  toSegmentId: string;
  type: ConnectorType;
  label: string;
}

export type SectionVisualState = 'blank' | 'skeleton' | 'content' | 'interactive';

export interface SectionState {
  id: string;
  label: string;
  state: SectionVisualState;
  kind: 'static' | 'dynamic';
}

export interface FilmstripFrame {
  timeMs: number;
  sections: SectionState[];
}

export interface Milestone {
  id: string;
  label: string;
  timeMs: number;
  color: string;
}

export interface Metrics {
  fcpMs: number;
  pageWithFallbacksMs: number;
  firstInteractiveMs: number;
  fullyLoadedMs: number;
  htmlKb: number;
  jsKb: number;
}

export interface Timeline {
  segments: Segment[];
  milestones: Milestone[];
  filmstripFrames: FilmstripFrame[];
  metrics: Metrics;
}

export interface SimulationResult {
  ssr: Timeline;
  rsc: Timeline;
  connectors: Connector[];
  maxDurationMs: number;
  sections: Section[];
}

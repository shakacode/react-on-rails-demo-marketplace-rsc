export type NetworkPreset = 'wifi' | 'fast4g' | 'slow4g' | 'slow3g';

export interface NetworkProfile {
  rttMs: number;
  bandwidthKbMs: number;
  label: string;
}

export interface PageSection {
  id: string;
  label: string;
  kind: 'static' | 'dynamic';
  cssKb: number;
  totalJsKb: number;
  clientJsKb: number;
  propsKb: number;
  htmlKb: number;
}

export type SectionVisualState = 'hidden' | 'skeleton' | 'visible' | 'interactive';

export interface SectionSnapshot {
  id: string;
  label: string;
  state: SectionVisualState;
  kind: 'static' | 'dynamic';
}

export interface TimelineSegment {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  color: string;
  row: number;
}

export interface Milestone {
  id: string;
  label: string;
  timeMs: number;
  color: string;
}

export interface Metrics {
  fcpMs: number;
  firstInteractiveMs: number;
  ttiMs: number;
  htmlKb: number;
  cssInHeadKb: number;
  jsBundleKb: number;
}

export interface SectionTimeline {
  sectionId: string;
  skeletonAtMs: number;
  visibleAtMs: number;
  interactiveAtMs: number;
}

export interface ArchitectureResult {
  segments: TimelineSegment[];
  milestones: Milestone[];
  metrics: Metrics;
  sectionTimelines: SectionTimeline[];
}

export interface SimulationResult {
  ssr: ArchitectureResult;
  rsc: ArchitectureResult;
  maxDurationMs: number;
}

export interface SimulationParams {
  networkPreset: NetworkPreset;
  sections: PageSection[];
}

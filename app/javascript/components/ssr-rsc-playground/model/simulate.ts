import { NETWORK_PROFILES } from '../defaults';
import type {
  ArchitectureResult,
  Metrics,
  Milestone,
  NetworkProfile,
  PageSection,
  SectionTimeline,
  SimulationParams,
  SimulationResult,
  TimelineSegment,
} from '../types';

const CDN_LATENCY_MS = 5;
const PRELOAD_SCANNER_DELAY_MS = 3;
const BASE_FRAMEWORK_JS_KB = 85;
const RSC_FRAMEWORK_JS_KB = 45;
const JS_PARSE_MS_PER_KB = 0.5;
const PROPS_DESER_BASE_MS = 5;
const PROPS_DESER_MS_PER_KB = 0.005;
const DATA_CACHE_PER_QUERY_MS = 15;
const HYDRATION_PER_SECTION_MS = 70;
const SELECTIVE_HYDRATION_MS = 20;
const SHELL_HTML_KB = 6;
const SHELL_CSS_KB = 8;
const SERVER_PROCESS_PER_BOUNDARY_MS = 25;
const RSC_PAYLOAD_PER_BOUNDARY_KB = 5;

function downloadTime(kb: number, net: NetworkProfile): number {
  if (kb <= 0) return 0;
  return kb / net.bandwidthKbMs + net.rttMs;
}

function simulateSSR(sections: PageSection[], net: NetworkProfile): ArchitectureResult {
  const totalHtmlKb = sections.reduce((s, sec) => s + sec.htmlKb, 0);
  const totalCssKb = sections.reduce((s, sec) => s + sec.cssKb, 0);
  const totalJsKb = BASE_FRAMEWORK_JS_KB + sections.reduce((s, sec) => s + sec.totalJsKb, 0);
  const totalPropsKb = sections.reduce((s, sec) => s + sec.propsKb, 0);
  const numQueries = sections.filter((s) => s.kind === 'dynamic').length;

  const segments: TimelineSegment[] = [];
  let row = 0;

  const cdnEnd = CDN_LATENCY_MS;
  segments.push({
    id: 'ssr-cdn',
    label: 'CDN Cache Hit',
    startMs: 0,
    endMs: cdnEnd,
    color: '#10b981',
    row: row++,
  });

  const htmlEnd = cdnEnd + downloadTime(totalHtmlKb, net);
  segments.push({
    id: 'ssr-html',
    label: `HTML (${Math.round(totalHtmlKb)} KB)`,
    startMs: cdnEnd,
    endMs: htmlEnd,
    color: '#3b82f6',
    row: row++,
  });

  const cssStart = cdnEnd + PRELOAD_SCANNER_DELAY_MS;
  const cssEnd = cssStart + downloadTime(totalCssKb, net);
  segments.push({
    id: 'ssr-css',
    label: `CSS (${Math.round(totalCssKb)} KB) — blocks paint`,
    startMs: cssStart,
    endMs: cssEnd,
    color: '#f59e0b',
    row: row++,
  });

  const jsStart = cdnEnd + PRELOAD_SCANNER_DELAY_MS;
  const jsEnd = jsStart + downloadTime(totalJsKb, net);
  segments.push({
    id: 'ssr-js',
    label: `JS Bundle (${Math.round(totalJsKb)} KB)`,
    startMs: jsStart,
    endMs: jsEnd,
    color: '#8b5cf6',
    row: row++,
  });

  const fcpMs = Math.max(htmlEnd, cssEnd);

  const jsParseEnd = jsEnd + totalJsKb * JS_PARSE_MS_PER_KB;
  segments.push({
    id: 'ssr-parse',
    label: 'JS Parsing',
    startMs: jsEnd,
    endMs: jsParseEnd,
    color: '#a855f7',
    row: row++,
  });

  const propsEnd = jsParseEnd + PROPS_DESER_BASE_MS + totalPropsKb * PROPS_DESER_MS_PER_KB;
  segments.push({
    id: 'ssr-props',
    label: 'Props Deserialization',
    startMs: jsParseEnd,
    endMs: propsEnd,
    color: '#ec4899',
    row: row++,
  });

  const cacheEnd = propsEnd + numQueries * DATA_CACHE_PER_QUERY_MS;
  if (numQueries > 0) {
    segments.push({
      id: 'ssr-cache',
      label: 'Data Cache Build',
      startMs: propsEnd,
      endMs: cacheEnd,
      color: '#f97316',
      row: row++,
    });
  }

  const hydrationStart = Math.max(numQueries > 0 ? cacheEnd : propsEnd, fcpMs);
  const hydrationEnd = hydrationStart + sections.length * HYDRATION_PER_SECTION_MS;
  segments.push({
    id: 'ssr-hydration',
    label: 'React Hydration (blocking)',
    startMs: hydrationStart,
    endMs: hydrationEnd,
    color: '#ef4444',
    row: row++,
  });

  const ttiMs = hydrationEnd;

  const milestones: Milestone[] = [
    { id: 'ssr-fcp', label: 'FCP', timeMs: fcpMs, color: '#3b82f6' },
    { id: 'ssr-tti', label: 'TTI', timeMs: ttiMs, color: '#ef4444' },
  ];

  const sectionTimelines: SectionTimeline[] = sections.map((sec) => ({
    sectionId: sec.id,
    skeletonAtMs: Infinity,
    visibleAtMs: fcpMs,
    interactiveAtMs: ttiMs,
  }));

  return {
    segments,
    milestones,
    metrics: { fcpMs, firstInteractiveMs: ttiMs, ttiMs, htmlKb: totalHtmlKb, cssInHeadKb: totalCssKb, jsBundleKb: totalJsKb },
    sectionTimelines,
  };
}

function simulateRSC(sections: PageSection[], net: NetworkProfile): ArchitectureResult {
  const clientJsKb = RSC_FRAMEWORK_JS_KB + sections.reduce((s, sec) => s + sec.clientJsKb, 0);

  const segments: TimelineSegment[] = [];
  let row = 0;

  const cdnEnd = CDN_LATENCY_MS;
  segments.push({ id: 'rsc-cdn', label: 'CDN Cache Hit', startMs: 0, endMs: cdnEnd, color: '#10b981', row: row++ });

  const shellHtmlEnd = cdnEnd + downloadTime(SHELL_HTML_KB, net);
  segments.push({ id: 'rsc-shell-html', label: `Shell HTML (${SHELL_HTML_KB} KB)`, startMs: cdnEnd, endMs: shellHtmlEnd, color: '#3b82f6', row: row++ });

  const shellCssStart = cdnEnd + PRELOAD_SCANNER_DELAY_MS;
  const shellCssEnd = shellCssStart + downloadTime(SHELL_CSS_KB, net);
  segments.push({ id: 'rsc-shell-css', label: `Shell CSS (${SHELL_CSS_KB} KB)`, startMs: shellCssStart, endMs: shellCssEnd, color: '#10b981', row: row++ });

  const shellFcpMs = Math.max(shellHtmlEnd, shellCssEnd);

  const jsStart = cdnEnd + PRELOAD_SCANNER_DELAY_MS;
  const jsEnd = jsStart + downloadTime(clientJsKb, net);
  segments.push({ id: 'rsc-js', label: `JS Bundle (${Math.round(clientJsKb)} KB)`, startMs: jsStart, endMs: jsEnd, color: '#8b5cf6', row: row++ });

  const jsParseEnd = jsEnd + clientJsKb * JS_PARSE_MS_PER_KB;
  segments.push({ id: 'rsc-parse', label: 'JS Parsing', startMs: jsEnd, endMs: jsParseEnd, color: '#a855f7', row: row++ });

  const jsReadyMs = jsParseEnd;
  const sectionTimelines: SectionTimeline[] = [];
  let streamCursor = shellFcpMs;

  if (sections.find((s) => s.id === 'header')) {
    sectionTimelines.push({ sectionId: 'header', skeletonAtMs: Infinity, visibleAtMs: shellFcpMs, interactiveAtMs: shellFcpMs });
  }

  const streamingSections = sections.filter((s) => s.id !== 'header');
  const boundaryRowStart = row;

  for (let i = 0; i < streamingSections.length; i++) {
    const sec = streamingSections[i];
    const bRow = boundaryRowStart + i;

    const streamStart = streamCursor + SERVER_PROCESS_PER_BOUNDARY_MS;
    const streamKb = sec.htmlKb + RSC_PAYLOAD_PER_BOUNDARY_KB;
    const streamEnd = streamStart + downloadTime(streamKb, net);
    const boundaryCssEnd = streamStart + downloadTime(sec.cssKb, net);
    const visibleAtMs = Math.max(streamEnd, boundaryCssEnd);

    const hydrationStart = Math.max(visibleAtMs, jsReadyMs);
    const hydrationTime = sec.clientJsKb > 0 ? SELECTIVE_HYDRATION_MS : 5;
    const interactiveAtMs = hydrationStart + hydrationTime;

    segments.push({ id: `rsc-stream-${sec.id}`, label: sec.label, startMs: streamStart, endMs: streamEnd, color: '#10b981', row: bRow });
    if (sec.clientJsKb > 0) {
      segments.push({ id: `rsc-hydrate-${sec.id}`, label: 'hydrate', startMs: hydrationStart, endMs: interactiveAtMs, color: '#6366f1', row: bRow });
    }

    sectionTimelines.push({ sectionId: sec.id, skeletonAtMs: shellFcpMs, visibleAtMs, interactiveAtMs });
    streamCursor = streamEnd;
  }

  const boundaryTimelines = sectionTimelines.filter((s) => s.sectionId !== 'header');
  const firstInteractiveMs = boundaryTimelines.length > 0 ? Math.min(...boundaryTimelines.map((s) => s.interactiveAtMs)) : shellFcpMs;
  const ttiMs = Math.max(...sectionTimelines.map((s) => s.interactiveAtMs));

  const milestones: Milestone[] = [
    { id: 'rsc-fcp', label: 'FCP', timeMs: shellFcpMs, color: '#10b981' },
    { id: 'rsc-tti', label: 'TTI', timeMs: ttiMs, color: '#6366f1' },
  ];

  return {
    segments,
    milestones,
    metrics: { fcpMs: shellFcpMs, firstInteractiveMs, ttiMs, htmlKb: SHELL_HTML_KB, cssInHeadKb: SHELL_CSS_KB, jsBundleKb: clientJsKb },
    sectionTimelines,
  };
}

export function simulate(params: SimulationParams): SimulationResult {
  const net = NETWORK_PROFILES[params.networkPreset];
  const ssr = simulateSSR(params.sections, net);
  const rsc = simulateRSC(params.sections, net);
  const maxDurationMs =
    Math.max(...ssr.segments.map((s) => s.endMs), ...rsc.segments.map((s) => s.endMs), ssr.metrics.ttiMs, rsc.metrics.ttiMs) * 1.05;
  return { ssr, rsc, maxDurationMs };
}

export function getSectionState(
  timeline: SectionTimeline,
  playheadMs: number
): 'hidden' | 'skeleton' | 'visible' | 'interactive' {
  if (playheadMs >= timeline.interactiveAtMs) return 'interactive';
  if (playheadMs >= timeline.visibleAtMs) return 'visible';
  if (playheadMs >= timeline.skeletonAtMs) return 'skeleton';
  return 'hidden';
}

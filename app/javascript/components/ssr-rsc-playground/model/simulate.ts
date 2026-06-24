import { COLORS, MILESTONE_COLORS, MODEL, NETWORK_PROFILES, SECTIONS } from '../defaults';
import type {
  Connector,
  FilmstripFrame,
  Metrics,
  Milestone,
  SectionState,
  Segment,
  SimulationParams,
  SimulationResult,
  Timeline,
} from '../types';

function downloadMs(kb: number, net: { rttMs: number; kbPerMs: number }) {
  return net.rttMs + kb / net.kbPerMs;
}

const dynamicSections = SECTIONS.filter((s) => s.kind === 'dynamic');
function buildSsrTimeline(params: SimulationParams): Timeline {
  const { menuItems, networkPreset } = params;
  const net = NETWORK_PROFILES[networkPreset];
  const M = MODEL;

  const segments: Segment[] = [];
  let row = 0;

  // --- Phase 1: Cache hit (cached_react_component) ---
  const cacheHitEnd = M.ssrCacheHitMs;
  segments.push({
    id: 'ssr-cache-hit',
    label: 'Cache Hit (fragment)',
    startMs: 0,
    endMs: cacheHitEnd,
    color: COLORS.cache,
    row: row++,
    category: 'cache',
  });

  // --- Phase 2: HTML download (cached SSR markup + fallback skeletons) ---
  const htmlKb = M.headerHtmlKb + menuItems * M.menuItemHtmlKb + dynamicSections.length * M.dynamicSectionFallbackKb;
  const htmlDlMs = downloadMs(htmlKb, net);
  const htmlStart = cacheHitEnd;
  const htmlEnd = htmlStart + htmlDlMs;

  segments.push({
    id: 'ssr-html-download',
    label: `HTML (${Math.round(htmlKb)} KB cached)`,
    startMs: htmlStart,
    endMs: htmlEnd,
    color: COLORS.htmlDownload,
    row: row++,
    category: 'network',
  });

  // FCP = when cached HTML paints (static content + skeleton fallbacks)
  const fcpMs = htmlEnd;

  // --- Phase 3: JS bundle download ---
  const jsKb = M.ssrBaseBundleKb + M.ssrMarkdownLibsKb + menuItems * M.ssrMenuJsPerItemKb;
  const jsDlMs = downloadMs(jsKb, net);
  const jsStart = htmlEnd;
  const jsEnd = jsStart + jsDlMs;

  segments.push({
    id: 'ssr-js-download',
    label: `JS Bundle (${Math.round(jsKb)} KB)`,
    startMs: jsStart,
    endMs: jsEnd,
    color: COLORS.jsDownload,
    row: row++,
    category: 'network',
  });

  // --- Phase 4: Full hydration (blocks main thread) ---
  const hydrationMs = M.ssrHydrationBaseMs + M.ssrHydrationPerItemMs * menuItems + M.ssrHydrationPerKbMs * htmlKb;
  const hydrationStart = jsEnd;
  const hydrationEnd = hydrationStart + hydrationMs;

  segments.push({
    id: 'ssr-hydration',
    label: `Hydration (${Math.round(hydrationMs)}ms blocks main thread)`,
    startMs: hydrationStart,
    endMs: hydrationEnd,
    color: COLORS.hydration,
    row: row++,
    category: 'browser',
  });

  // Page with fallbacks = when HTML is painted (skeletons visible for dynamic parts)
  const pageWithFallbacksMs = fcpMs;

  // --- Phase 5: Loadable components for dynamic sections ---
  const dynamicTimings: { id: string; visibleMs: number; interactiveMs: number }[] = [];
  let firstInteractiveMs = Infinity;

  dynamicSections.forEach((section, i) => {
    const chunkKb = M.ssrLazyChunkBaseKb + M.ssrLoadableChunkKb * (i === 0 ? 1.5 : 1);
    const chunkDlMs = downloadMs(chunkKb, net);
    const chunkStart = hydrationEnd;
    const chunkEnd = chunkStart + chunkDlMs;

    const fetchMs = M.ssrClientFetchBaseMs + M.ssrClientFetchPerSectionMs * (i * 0.5);
    const fetchEnd = chunkEnd + fetchMs;

    const renderEnd = fetchEnd + M.ssrLazyRenderMs;

    if (i < 4) {
      segments.push({
        id: `ssr-chunk-${section.id}`,
        label: section.label,
        startMs: chunkStart,
        endMs: chunkEnd,
        color: COLORS.lazyChunk,
        row: row,
        category: 'deferred',
      });

      segments.push({
        id: `ssr-fetch-${section.id}`,
        label: `fetch`,
        startMs: chunkEnd,
        endMs: fetchEnd,
        color: COLORS.clientFetch,
        row: row,
        category: 'deferred',
      });

      segments.push({
        id: `ssr-render-${section.id}`,
        label: `render`,
        startMs: fetchEnd,
        endMs: renderEnd,
        color: COLORS.lazyRender,
        row: row,
        category: 'deferred',
      });
      row++;
    }

    dynamicTimings.push({ id: section.id, visibleMs: fetchEnd, interactiveMs: renderEnd });
    if (renderEnd < firstInteractiveMs) firstInteractiveMs = renderEnd;
  });

  const fullyLoadedMs = Math.max(hydrationEnd, ...dynamicTimings.map((d) => d.interactiveMs));
  if (firstInteractiveMs === Infinity) firstInteractiveMs = hydrationEnd;

  // --- Milestones ---
  const milestones: Milestone[] = [
    { id: 'ssr-fcp', label: 'FCP', timeMs: fcpMs, color: MILESTONE_COLORS.fcp },
    { id: 'ssr-fallbacks', label: 'Page with Fallbacks', timeMs: pageWithFallbacksMs, color: MILESTONE_COLORS.fallbacks },
    { id: 'ssr-first-interactive', label: 'First Interactive', timeMs: firstInteractiveMs, color: MILESTONE_COLORS.firstInteractive },
    { id: 'ssr-fully-loaded', label: 'Fully Loaded', timeMs: fullyLoadedMs, color: MILESTONE_COLORS.fullyLoaded },
  ];

  // --- Metrics ---
  const metrics: Metrics = {
    fcpMs: Math.round(fcpMs),
    pageWithFallbacksMs: Math.round(pageWithFallbacksMs),
    firstInteractiveMs: Math.round(firstInteractiveMs),
    fullyLoadedMs: Math.round(fullyLoadedMs),
    htmlKb: Math.round(htmlKb),
    jsKb: Math.round(jsKb),
  };

  // --- Filmstrip ---
  const filmstripFrames = buildSsrFilmstrip(
    fcpMs,
    hydrationEnd,
    dynamicTimings,
    fullyLoadedMs,
  );

  return { segments, milestones, filmstripFrames, metrics };
}

function buildRscTimeline(params: SimulationParams): Timeline {
  const { menuItems, networkPreset } = params;
  const net = NETWORK_PROFILES[networkPreset];
  const M = MODEL;

  const segments: Segment[] = [];
  let row = 0;

  // --- Phase 1: Shell cache hit ---
  const shellCacheEnd = M.rscShellCacheHitMs;
  segments.push({
    id: 'rsc-cache-hit',
    label: 'Shell Cache Hit',
    startMs: 0,
    endMs: shellCacheEnd,
    color: COLORS.rscShell,
    row: row++,
    category: 'cache',
  });

  // --- Phase 2: Shell HTML download (tiny — just header + menu skeleton) ---
  const shellHtmlKb = M.rscShellHtmlKb;
  const shellDlMs = downloadMs(shellHtmlKb, { rttMs: M.rscEdgeRttMs, kbPerMs: net.kbPerMs });
  const shellStart = shellCacheEnd;
  const shellEnd = shellStart + shellDlMs;

  segments.push({
    id: 'rsc-shell-download',
    label: `Shell HTML (${Math.round(shellHtmlKb)} KB)`,
    startMs: shellStart,
    endMs: shellEnd,
    color: COLORS.rscEdge,
    row: row++,
    category: 'network',
  });

  const fcpMs = shellEnd;

  // --- Phase 3: JS bundle download (small — only interactive islands) ---
  const jsKb = M.rscBaseBundleKb + dynamicSections.length * M.rscInteractiveIslandKb;
  const jsDlMs = downloadMs(jsKb, net);
  const jsStart = shellEnd;
  const jsEnd = jsStart + jsDlMs;

  segments.push({
    id: 'rsc-js-download',
    label: `JS Bundle (${Math.round(jsKb)} KB)`,
    startMs: jsStart,
    endMs: jsEnd,
    color: COLORS.jsDownload,
    row: row++,
    category: 'network',
  });

  // --- Phase 4: Static content streams (menu items rendered server-side) ---
  const menuStreamMs = M.rscStreamBaseMs + menuItems * 0.8;
  const menuStreamStart = shellCacheEnd;
  const menuStreamEnd = menuStreamStart + menuStreamMs;
  const menuDeliveryEnd = menuStreamEnd + downloadMs(menuItems * M.menuItemHtmlKb * 0.5, net);

  segments.push({
    id: 'rsc-menu-stream',
    label: `Menu (${menuItems} items) stream`,
    startMs: menuStreamStart,
    endMs: menuDeliveryEnd,
    color: COLORS.rscStream,
    row: row++,
    category: 'server',
  });

  // Page with fallbacks = when shell paints (Suspense fallbacks for dynamic sections)
  const pageWithFallbacksMs = fcpMs;

  // --- Phase 5: Dynamic sections stream + selective hydration ---
  const dynamicTimings: { id: string; visibleMs: number; interactiveMs: number }[] = [];
  let streamCursor = shellCacheEnd + M.rscStreamBaseMs * 0.5;

  dynamicSections.forEach((section, i) => {
    const streamDuration = M.rscStreamPerSectionMs * (1 + i * 0.15);
    const sectionStreamStart = streamCursor;
    const sectionStreamEnd = sectionStreamStart + streamDuration;

    const deliveryMs = downloadMs(M.rscSectionHtmlKb, net);
    const deliveryEnd = sectionStreamEnd + deliveryMs;

    const hydrationStart = Math.max(deliveryEnd, jsEnd);
    const hydrationEnd = hydrationStart + M.rscSelectiveHydrationMs;

    if (i < 5) {
      segments.push({
        id: `rsc-stream-${section.id}`,
        label: section.label,
        startMs: sectionStreamStart,
        endMs: deliveryEnd,
        color: COLORS.rscStream,
        row: row,
        category: 'server',
      });

      segments.push({
        id: `rsc-hydrate-${section.id}`,
        label: 'hydrate',
        startMs: hydrationStart,
        endMs: hydrationEnd,
        color: COLORS.rscHydration,
        row: row,
        category: 'browser',
      });
      row++;
    }

    dynamicTimings.push({ id: section.id, visibleMs: deliveryEnd, interactiveMs: hydrationEnd });
    streamCursor = sectionStreamStart + streamDuration * M.rscStreamOverlapFactor;
  });

  const firstInteractiveMs = dynamicTimings.length > 0
    ? Math.min(...dynamicTimings.map((d) => d.interactiveMs))
    : jsEnd;

  const fullyLoadedMs = Math.max(
    jsEnd,
    menuDeliveryEnd,
    ...dynamicTimings.map((d) => d.interactiveMs),
  );

  // --- Milestones ---
  const milestones: Milestone[] = [
    { id: 'rsc-fcp', label: 'FCP', timeMs: fcpMs, color: MILESTONE_COLORS.fcp },
    { id: 'rsc-fallbacks', label: 'Page with Fallbacks', timeMs: pageWithFallbacksMs, color: MILESTONE_COLORS.fallbacks },
    { id: 'rsc-first-interactive', label: 'First Interactive', timeMs: firstInteractiveMs, color: MILESTONE_COLORS.firstInteractive },
    { id: 'rsc-fully-loaded', label: 'Fully Loaded', timeMs: fullyLoadedMs, color: MILESTONE_COLORS.fullyLoaded },
  ];

  const htmlKb = shellHtmlKb + menuItems * M.menuItemHtmlKb * 0.5 + dynamicSections.length * M.rscSectionHtmlKb;
  const metrics: Metrics = {
    fcpMs: Math.round(fcpMs),
    pageWithFallbacksMs: Math.round(pageWithFallbacksMs),
    firstInteractiveMs: Math.round(firstInteractiveMs),
    fullyLoadedMs: Math.round(fullyLoadedMs),
    htmlKb: Math.round(htmlKb),
    jsKb: Math.round(jsKb),
  };

  const filmstripFrames = buildRscFilmstrip(
    fcpMs,
    menuDeliveryEnd,
    dynamicTimings,
    fullyLoadedMs,
  );

  return { segments, milestones, filmstripFrames, metrics };
}

function buildSsrFilmstrip(
  fcpMs: number,
  hydrationEnd: number,
  dynamicTimings: { id: string; visibleMs: number; interactiveMs: number }[],
  maxMs: number,
): FilmstripFrame[] {
  const times = [0, fcpMs * 0.5, fcpMs, hydrationEnd, (hydrationEnd + maxMs) / 2, maxMs];
  return times.map((t) => ({
    timeMs: t,
    sections: SECTIONS.map((sec) => {
      if (sec.kind === 'static') {
        let state: SectionState['state'] = 'blank';
        if (t >= hydrationEnd) state = 'interactive';
        else if (t >= fcpMs) state = 'content';
        return { id: sec.id, label: sec.label, state, kind: sec.kind };
      }
      const dyn = dynamicTimings.find((d) => d.id === sec.id);
      let state: SectionState['state'] = 'blank';
      if (dyn) {
        if (t >= dyn.interactiveMs) state = 'interactive';
        else if (t >= dyn.visibleMs) state = 'content';
        else if (t >= fcpMs) state = 'skeleton';
      }
      return { id: sec.id, label: sec.label, state, kind: sec.kind };
    }),
  }));
}

function buildRscFilmstrip(
  fcpMs: number,
  menuReadyMs: number,
  dynamicTimings: { id: string; visibleMs: number; interactiveMs: number }[],
  maxMs: number,
): FilmstripFrame[] {
  const times = [0, fcpMs * 0.5, fcpMs, menuReadyMs, (menuReadyMs + maxMs) / 2, maxMs];
  return times.map((t) => ({
    timeMs: t,
    sections: SECTIONS.map((sec) => {
      if (sec.kind === 'static') {
        let state: SectionState['state'] = 'blank';
        if (t >= menuReadyMs) state = 'interactive';
        else if (t >= fcpMs) state = 'content';
        return { id: sec.id, label: sec.label, state, kind: sec.kind };
      }
      const dyn = dynamicTimings.find((d) => d.id === sec.id);
      let state: SectionState['state'] = 'blank';
      if (dyn) {
        if (t >= dyn.interactiveMs) state = 'interactive';
        else if (t >= dyn.visibleMs) state = 'content';
        else if (t >= fcpMs) state = 'skeleton';
      }
      return { id: sec.id, label: sec.label, state, kind: sec.kind };
    }),
  }));
}

function buildConnectors(ssrSegments: Segment[], rscSegments: Segment[]): Connector[] {
  const connectors: Connector[] = [];

  const ssrHydration = ssrSegments.find((s) => s.id === 'ssr-hydration');
  const rscHydrateCart = rscSegments.find((s) => s.id === 'rsc-hydrate-cart');
  if (ssrHydration && rscHydrateCart) {
    connectors.push({
      id: 'conn-hydration',
      fromSegmentId: ssrHydration.id,
      toSegmentId: rscHydrateCart.id,
      type: 'eliminated',
      label: 'Full-page hydration replaced by selective hydration per section',
    });
  }

  const ssrFetchCart = ssrSegments.find((s) => s.id === 'ssr-fetch-cart');
  const rscStreamCart = rscSegments.find((s) => s.id === 'rsc-stream-cart');
  if (ssrFetchCart && rscStreamCart) {
    connectors.push({
      id: 'conn-fetch',
      fromSegmentId: ssrFetchCart.id,
      toSegmentId: rscStreamCart.id,
      type: 'eliminated',
      label: 'Client fetch waterfall eliminated — data rendered server-side and streamed',
    });
  }

  const ssrJs = ssrSegments.find((s) => s.id === 'ssr-js-download');
  const rscJs = rscSegments.find((s) => s.id === 'rsc-js-download');
  if (ssrJs && rscJs) {
    connectors.push({
      id: 'conn-bundle',
      fromSegmentId: ssrJs.id,
      toSegmentId: rscJs.id,
      type: 'overlapped',
      label: 'JS bundle shrunk — markdown/sanitize libs stay server-side',
    });
  }

  const ssrHtml = ssrSegments.find((s) => s.id === 'ssr-html-download');
  const rscShell = rscSegments.find((s) => s.id === 'rsc-shell-download');
  if (ssrHtml && rscShell) {
    connectors.push({
      id: 'conn-html',
      fromSegmentId: ssrHtml.id,
      toSegmentId: rscShell.id,
      type: 'streamed',
      label: 'Full cached HTML replaced by tiny shell + incremental streams',
    });
  }

  return connectors;
}

export function simulate(params: SimulationParams): SimulationResult {
  const ssr = buildSsrTimeline(params);
  const rsc = buildRscTimeline(params);

  const connectors = buildConnectors(ssr.segments, rsc.segments);
  const maxDurationMs = Math.max(
    ...ssr.segments.map((s) => s.endMs),
    ...rsc.segments.map((s) => s.endMs),
    ...ssr.milestones.map((m) => m.timeMs),
    ...rsc.milestones.map((m) => m.timeMs),
  );

  return { ssr, rsc, connectors, maxDurationMs, sections: SECTIONS };
}

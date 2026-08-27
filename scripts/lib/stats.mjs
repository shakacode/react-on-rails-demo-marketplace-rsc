export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function p75(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

function summarize(values) {
  if (values.length === 0) {
    return { median: 0, p75: 0, min: 0, max: 0, values: [] };
  }
  return {
    median: round(median(values)),
    p75: round(p75(values)),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    values: values.map(round),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export function aggregateRuns(runs, warmupCount) {
  const effective = runs.slice(warmupCount);
  if (effective.length === 0) return null;

  const metricKeys = [
    'fcp', 'lcp', 'cls', 'ttfb', 'tbt',
    'hydrationDuration', 'inp',
    'jsTransferSize', 'jsDecodedSize',
    'streamingDuration',
  ];

  // Scroll-cycle metrics (issue #184) exist only on lanes that opt into
  // `scroll: true` — omitted (not zero-filled) everywhere else so the JSON
  // shape of existing lanes is unchanged.
  const optionalMetricKeys = [
    'domNodesPostHydration', 'domNodesAtBottom', 'domNodesPostScroll',
    'heapUsedPostLoad', 'heapUsedPostScroll',
    'scrollLongTaskTime', 'scrollLongTaskCount',
    'scrollLoafTime', 'scrollLoafCount', 'scrollLoafMax',
    'scrollDuration', 'scrollSteps', 'scrollCycleComplete', 'scrollCoverage',
  ];

  const result = {};
  for (const key of metricKeys) {
    const values = effective
      .map((run) => run[key])
      .filter((v) => v != null && !Number.isNaN(v));
    result[key] = summarize(values);
  }
  for (const key of optionalMetricKeys) {
    const values = effective
      .map((run) => run[key])
      .filter((v) => v != null && !Number.isNaN(v));
    if (values.length > 0) result[key] = summarize(values);
  }

  // Merge JS resources from last effective run (sizes are deterministic)
  const lastRun = effective[effective.length - 1];
  result.jsResources = lastRun.jsResources || [];

  return result;
}

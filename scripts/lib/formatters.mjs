import Table from 'cli-table3';

const METRIC_CONFIG = [
  { key: 'ttfb', label: 'TTFB', unit: 'ms' },
  { key: 'fcp', label: 'FCP', unit: 'ms' },
  { key: 'lcp', label: 'LCP', unit: 'ms' },
  { key: 'cls', label: 'CLS', unit: '' },
  { key: 'tbt', label: 'TBT', unit: 'ms' },
  { key: 'inp', label: 'INP', unit: 'ms' },
  { key: 'hydrationDuration', label: 'Hydration', unit: 'ms' },
  { key: 'streamingDuration', label: 'Streaming', unit: 'ms' },
  { key: 'jsTransferSize', label: 'JS Transfer', unit: 'KB' },
  { key: 'jsDecodedSize', label: 'JS Decoded', unit: 'KB' },
  // Scroll-cycle metrics (issue #184) — present only on `scroll: true` lanes.
  { key: 'scrollLongTaskTime', label: 'Scroll long tasks', unit: 'ms' },
  { key: 'scrollLongTaskCount', label: 'Scroll long tasks #', unit: 'count' },
  { key: 'scrollLoafTime', label: 'Scroll LoAF blocking', unit: 'ms' },
  { key: 'scrollLoafMax', label: 'Scroll LoAF max', unit: 'ms' },
  { key: 'domNodesPostHydration', label: 'DOM nodes (post-hydration)', unit: 'count' },
  { key: 'domNodesAtBottom', label: 'DOM nodes (at bottom)', unit: 'count' },
  { key: 'domNodesPostScroll', label: 'DOM nodes (post-scroll)', unit: 'count' },
  { key: 'heapUsedPostLoad', label: 'JS heap (post-load)', unit: 'MB' },
  { key: 'heapUsedPostScroll', label: 'JS heap (post-scroll)', unit: 'MB' },
];

function fmt(value, unit) {
  if (value == null || (typeof value === 'number' && Number.isNaN(value))) return '-';
  if (unit === 'KB') return `${(value / 1024).toFixed(1)} KB`;
  if (unit === 'MB') return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (unit === 'ms') return `${value.toFixed(1)} ms`;
  if (unit === 'count') return `${Math.round(value)}`;
  return value.toFixed(4);
}

export function formatComparisonTable(results) {
  const versions = Object.keys(results);
  const table = new Table({
    head: ['Metric', ...versions.map((v) => results[v]._label || v)],
    style: { head: ['cyan'] },
  });

  for (const { key, label, unit } of METRIC_CONFIG) {
    const row = [label];
    for (const version of versions) {
      const data = results[version][key];
      if (data && data.median != null) {
        const med = fmt(data.median, unit);
        const p = fmt(data.p75, unit);
        row.push(`${med} (p75: ${p})`);
      } else {
        row.push('-');
      }
    }
    table.push(row);
  }

  return table.toString();
}

export function formatJsBreakdownTable(version, data) {
  const resources = data.jsResources || [];
  if (resources.length === 0) return null;

  const table = new Table({
    head: ['Resource', 'Transfer', 'Decoded'],
    style: { head: ['cyan'] },
    colWidths: [60, 15, 15],
  });

  const sorted = [...resources].sort((a, b) => b.transferSize - a.transferSize);
  for (const r of sorted) {
    const name = r.url.split('/').pop().split('?')[0] || r.url;
    table.push([
      name.length > 57 ? name.slice(0, 57) + '...' : name,
      fmt(r.transferSize, 'KB'),
      fmt(r.decodedBodySize, 'KB'),
    ]);
  }

  return `\nJS Breakdown: ${version}\n${table.toString()}`;
}

export function formatDiffTable(before, after) {
  const versions = Object.keys(after.results);
  const table = new Table({
    head: ['Metric', 'Version', 'Before', 'After', 'Delta', 'Change'],
    style: { head: ['cyan'] },
  });

  for (const { key, label, unit } of METRIC_CONFIG) {
    for (const version of versions) {
      const bData = before.results[version]?.[key];
      const aData = after.results[version]?.[key];
      const bVal = bData?.median;
      const aVal = aData?.median;

      if (bVal == null && aVal == null) continue;

      const bStr = bVal != null ? fmt(bVal, unit) : '-';
      const aStr = aVal != null ? fmt(aVal, unit) : '-';

      let deltaStr = '-';
      let changeStr = '-';

      if (bVal != null && aVal != null) {
        const delta = aVal - bVal;
        const pct = bVal !== 0 ? (delta / bVal) * 100 : 0;
        const sign = delta > 0 ? '+' : '';
        deltaStr = `${sign}${fmt(delta, unit)}`;

        const color = key === 'cls'
          ? (delta <= 0 ? '\x1b[32m' : '\x1b[31m')
          : (delta <= 0 ? '\x1b[32m' : '\x1b[31m');
        changeStr = `${color}${sign}${pct.toFixed(1)}%\x1b[0m`;
      }

      table.push([label, version, bStr, aStr, deltaStr, changeStr]);
    }
  }

  return table.toString();
}

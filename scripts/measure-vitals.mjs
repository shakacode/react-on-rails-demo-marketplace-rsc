#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { DEFAULTS, MOBILE, PAGES } from './lib/constants.mjs';
import { measurePage } from './lib/runner.mjs';
import { aggregateRuns } from './lib/stats.mjs';
import { formatComparisonTable, formatJsBreakdownTable } from './lib/formatters.mjs';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: DEFAULTS.baseUrl },
    pages: { type: 'string', default: 'ssr,client,rsc' },
    iterations: { type: 'string', short: 'n', default: String(DEFAULTS.iterations) },
    warmup: { type: 'string', short: 'w', default: String(DEFAULTS.warmup) },
    output: { type: 'string', short: 'o' },
    label: { type: 'string', short: 'l', default: '' },
    throttle: { type: 'boolean', default: false },
    headless: { type: 'boolean', default: true },
    verbose: { type: 'boolean', short: 'v', default: false },
    // Mobile emulation (viewport/UA/touch) — see MOBILE in lib/constants.mjs.
    mobile: { type: 'boolean', default: false },
    // Extra query string appended to every measured page path, e.g.
    // --query "count=500&initial=0" for the issue #184 sweeps.
    query: { type: 'string', default: '' },
  },
  strict: false,
});

const baseUrl = args.url;
const pageKeys = args.pages.split(',').map((s) => s.trim());
const iterations = parseInt(args.iterations, 10);
const warmup = parseInt(args.warmup, 10);
const verbose = args.verbose;

async function healthCheck(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\nWeb Vitals Measurement Tool');
  console.log('==========================\n');
  console.log(`Base URL:    ${baseUrl}`);
  console.log(`Pages:       ${pageKeys.join(', ')}`);
  console.log(`Iterations:  ${iterations} (warmup: ${warmup})`);
  console.log(`Throttle:    ${args.throttle ? 'ON (4x CPU, Slow 3G)' : 'OFF'}`);
  console.log(`Profile:     ${args.mobile ? 'mobile (390x844, DPR 3, touch)' : 'desktop (default viewport)'}`);
  if (args.query) console.log(`Query:       ?${args.query}`);
  if (args.label) console.log(`Label:       ${args.label}`);
  console.log('');

  // Health check
  const firstPage = PAGES[pageKeys[0]];
  if (!firstPage) {
    console.error(`Unknown page key: ${pageKeys[0]}. Valid: ${Object.keys(PAGES).join(', ')}`);
    process.exit(1);
  }

  const healthy = await healthCheck(`${baseUrl}${firstPage.path}`);
  if (!healthy) {
    console.error(`Server not reachable at ${baseUrl}. Is it running? (try: bin/dev)`);
    process.exit(1);
  }
  console.log('Server health check passed.\n');

  // Launch browser
  const browser = await puppeteer.launch({
    headless: args.headless ? 'new' : false,
    // --enable-precise-memory-info: un-quantizes performance.memory so the
    // JS-heap samples from the scroll cycle are comparable between lanes.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-precise-memory-info'],
  });

  // Record the UA the measured pages actually see: --mobile runs override the
  // page UA with MOBILE.userAgent (lib/runner.mjs), not the browser default.
  const userAgent = args.mobile ? MOBILE.userAgent : await browser.userAgent();
  const allResults = {};
  // A lane that throws (e.g. a declared interaction selector that cannot be
  // found — deliberately a hard failure per lane) is recorded here instead of
  // aborting the whole run: remaining lanes still measure, collected results
  // are still written, and the process exits non-zero at the end.
  const failedLanes = {};

  try {
    for (const key of pageKeys) {
      const config = PAGES[key];
      if (!config) {
        console.warn(`Skipping unknown page key: ${key}`);
        continue;
      }

      console.log(`Measuring ${config.label} (${iterations} iterations)...`);
      const runs = [];

      try {
        for (let i = 0; i < iterations; i++) {
          const isWarmup = i < warmup;
          const prefix = isWarmup ? `  [warmup ${i + 1}/${warmup}]` : `  [run ${i - warmup + 1}/${iterations - warmup}]`;

          if (verbose) console.log(`${prefix} starting...`);

          const result = await measurePage(browser, config, {
            baseUrl,
            timeout: DEFAULTS.timeout,
            throttle: args.throttle,
            verbose,
            mobile: args.mobile,
            query: args.query,
          });

          runs.push(result);

          if (verbose) {
            console.log(`${prefix} FCP=${result.fcp?.toFixed(0)}ms LCP=${result.lcp?.toFixed(0)}ms Hydration=${result.hydrationDuration?.toFixed(0)}ms`);
          } else {
            process.stdout.write('.');
          }
        }
        if (!verbose) console.log(' done');
      } catch (err) {
        if (!verbose) console.log('');
        console.error(`  Lane ${key} FAILED after ${runs.length}/${iterations} run(s): ${err.message}`);
        failedLanes[key] = { error: err.message, completedRuns: runs.length };
        continue;
      }

      const aggregated = aggregateRuns(runs, warmup);
      if (aggregated) {
        aggregated._label = config.label;
        allResults[key] = aggregated;
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // Save JSON output first — a formatting hiccup must not lose the data.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(process.cwd(), '.vitals-results');
  const outputFile = args.output || join(outputDir, `${timestamp}${args.label ? '-' + args.label : ''}.json`);

  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      label: args.label || null,
      baseUrl,
      iterations,
      warmup,
      throttle: args.throttle,
      mobile: args.mobile,
      query: args.query || null,
      userAgent,
    },
    results: {},
  };

  for (const [key, data] of Object.entries(allResults)) {
    const { _label, ...metrics } = data;
    output.results[key] = metrics;
  }
  if (Object.keys(failedLanes).length > 0) {
    output.failures = failedLanes;
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(output, null, 2));

  // Display comparison table
  console.log('\n' + formatComparisonTable(allResults));

  // Display JS breakdowns if verbose
  if (verbose) {
    for (const [version, data] of Object.entries(allResults)) {
      const breakdown = formatJsBreakdownTable(version, data);
      if (breakdown) console.log(breakdown);
    }
  }

  for (const [key, failure] of Object.entries(failedLanes)) {
    console.error(`FAILED lane ${key}: ${failure.error} (after ${failure.completedRuns} completed run(s))`);
  }

  console.log(`\nResults saved to: ${outputFile}`);

  if (Object.keys(failedLanes).length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  if (verbose) console.error(err.stack);
  process.exit(1);
});

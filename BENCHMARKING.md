# Benchmarking Guide

This project has **two performance measurement suites**. Choose the right one:

| Question | Tool | Command |
|----------|------|---------|
| How fast is page X on this server? | Puppeteer/web-vitals | `pnpm vitals` |
| How do SSR vs Client vs RSC compare? | Puppeteer/web-vitals | `pnpm vitals:compare` |
| Did this branch make things slower? | **ShakaPerf** | `pnpm perf:compare` |
| Did commit A regress vs commit B? | **ShakaPerf** | `pnpm perf:compare:commits A B` |
| What problems does this page have? | **ShakaPerf** | `pnpm perf:audit` |

**Puppeteer/web-vitals** (`pnpm vitals`) measures absolute per-page numbers on
one running server. Good for comparing rendering strategies (SSR vs RSC) on the
same code version.

**ShakaPerf** (`pnpm perf:compare`) compares two code versions under paired
simultaneous sampling with statistical gating. Good for detecting regressions
across commits. See [ShakaPerf A/B Testing](#shakaperf-ab-testing) below.

---

## Puppeteer/web-vitals Suite

This suite measures Web Vitals for the SSR, Client, and RSC versions of the blog post page.

## Running the App in Production

Build assets first, then start the node renderer and Rails server:

```bash
# 1. Build production assets
NODE_ENV=production bin/shakapacker --mode production

# 2. Start the node renderer
NODE_ENV=production node node-renderer.js &

# 3. Start Rails
RAILS_ENV=production \
  RAILS_SERVE_STATIC_FILES=true \
  SECRET_KEY_BASE=dummy_secret_key_base_for_testing_1234567890abcdef \
  bundle exec rails server -p 3000
```

`RAILS_SERVE_STATIC_FILES=true` is required for local production testing — without it, Rails won't serve CSS/JS assets.

### Page URLs

| Version | URL | Description |
|---------|-----|-------------|
| SSR (V1) | `/blog/ssr` | All data fetched on server, full HTML returned at once |
| Client (V2) | `/blog/client` | Loadable components, client-side rendering |
| RSC (V3) | `/blog/rsc` | RSC streaming with async props |

## Benchmarking Scripts

### Primary: `pnpm vitals`

Measures Web Vitals across all three page versions using Puppeteer with the [web-vitals](https://github.com/GoogleChrome/web-vitals) library (IIFE bundle injected into each page).

```bash
# Default: 7 iterations, 2 warmup, no throttling
pnpm vitals

# With network/CPU throttling (4x CPU slowdown, Slow 3G)
pnpm vitals -- --throttle

# Measure specific pages only
pnpm vitals -- --pages ssr,rsc

# Quick run (3 iterations, 1 warmup)
pnpm vitals:quick
```

The server must be running before executing any benchmarking script.

### CLI Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--url` | | `http://localhost:3000` | Base URL of the running server |
| `--pages` | | `ssr,client,rsc` | Comma-separated page keys to measure |
| `--iterations` | `-n` | `7` | Total iterations (includes warmup) |
| `--warmup` | `-w` | `2` | Number of warmup runs (discarded from results) |
| `--throttle` | | `false` | Enable CPU (4x) and network (Slow 3G) throttling |
| `--headless` | | `true` | Run browser in headless mode |
| `--verbose` | `-v` | `false` | Show per-iteration results and JS breakdowns |
| `--label` | `-l` | | Label for the output JSON file |
| `--output` | `-o` | auto-generated | Custom output file path |
| `--mobile` | | `false` | Emulate a phone (390×844, DPR 3, touch, mobile UA) |
| `--query` | | | Query string appended to every measured path (e.g. `--query "count=500"`). The restaurant `count`/`initial` knobs are measurement-only: the Rails server must be started with `ENABLE_BENCH_PARAMS=1` or they are ignored |

### Scroll-heavy lanes (issue #184)

The restaurant detail lanes (`restaurant-ssr`, `restaurant-client`,
`restaurant-rsc`, `restaurant-ssr-virtual`, `restaurant-rsc-virtual`) opt into
a scripted scroll cycle: the runner wheels to the bottom of the page and back,
then clicks a review's "Helpful" button for INP. These lanes report extra
metrics:

| Metric | What it measures |
|--------|------------------|
| Scroll long tasks (ms/#) | Long-task blocking time raised **during** the scroll cycle — kept out of TBT so load-phase TBT is not double-counted. INP cannot see scrolling (Event Timing only observes discrete interactions), so this is the scroll-responsiveness number |
| Scroll LoAF blocking/max | Long-animation-frame data during the cycle (rendering-pipeline jank) |
| DOM nodes (post-hydration / at bottom / post-scroll) | Live DOM size before, during, and after the cycle — the virtualization payoff |
| JS heap (post-load / post-scroll) | `usedJSHeapSize` after a forced GC |

A lane that declares an interaction selector fails loudly when the target is
missing instead of silently reporting no INP. The scroll cycle likewise
asserts completion — its step budget adapts to the measured document height,
`scrollCycleComplete`/`scrollCoverage` land in the results JSON, and a
traversal that cannot reach the bottom and return fails the lane rather than
recording partial bottom-of-page metrics.

### Compare Results: `pnpm vitals:compare`

Compare two saved JSON result files side by side with percentage diffs:

```bash
pnpm vitals:compare -- .vitals-results/before.json .vitals-results/after.json
```

### JS Bundle Breakdown: `node scripts/measure-js-breakdown.js`

Shows exactly which JS files are loaded for SSR vs RSC, sorted by transfer size:

```bash
node scripts/measure-js-breakdown.js
```

### Automated Delay Testing: `scripts/measure-with-delays.sh`

Runs throttled benchmarks at multiple content delays (0ms, 200ms, 500ms). Automatically starts/stops production servers with the appropriate `CONTENT_DELAY_MS` env var:

```bash
bash scripts/measure-with-delays.sh
```

## Reading the Output

Each run prints a comparison table and saves a JSON file to `.vitals-results/`.

### Metrics

| Metric | Unit | What it Measures |
|--------|------|------------------|
| TTFB | ms | Time to First Byte — server response time |
| FCP | ms | First Contentful Paint — when the browser first renders any content |
| LCP | ms | Largest Contentful Paint — when the largest visible element finishes rendering |
| CLS | score | Cumulative Layout Shift — visual stability (lower is better) |
| TBT | ms | Total Blocking Time — sum of long-task blocking time (>50ms per task) |
| INP | ms | Interaction to Next Paint — responsiveness to user input |
| Hydration | ms | Time from DOMContentLoaded until React fibers attach to the like button |
| Streaming | ms | Time from navigation start until the "Related Posts" section appears in the DOM |
| JS Transfer | KB | Total compressed JavaScript transferred over the network |
| JS Decoded | KB | Total uncompressed JavaScript size |

### Output JSON Structure

Results are saved to `.vitals-results/<timestamp>-<label>.json`:

```json
{
  "metadata": {
    "timestamp": "2026-02-21T14:38:02.377Z",
    "label": "delay-500ms",
    "baseUrl": "http://localhost:3000",
    "iterations": 12,
    "warmup": 3,
    "throttle": true
  },
  "results": {
    "ssr": {
      "fcp": { "median": 1492, "p75": 1516, "min": 1380, "max": 1620, "values": [...] },
      "lcp": { ... },
      ...
    },
    "rsc": { ... }
  }
}
```

Each metric includes `median`, `p75`, `min`, `max`, and the raw `values` array (warmup runs excluded).

## Testing with Content Delays

The `CONTENT_DELAY_MS` environment variable simulates slow backend data fetching. This highlights the difference between SSR (blocks the entire response) and RSC (streams the shell immediately, delays only the content):

```bash
# Start Rails with a 500ms content delay
CONTENT_DELAY_MS=500 RAILS_ENV=production \
  RAILS_SERVE_STATIC_FILES=true \
  SECRET_KEY_BASE=dummy_secret_key_base_for_testing_1234567890abcdef \
  bundle exec rails server -p 3000
```

At 0ms delay, SSR and RSC have similar FCP because data is instant and RSC's double-pass rendering overhead offsets its streaming advantage. As delay increases, RSC's FCP stays flat (shell streams immediately) while SSR's FCP grows proportionally.

## List virtualization (react-virtuoso) investigation

Issue [#184](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/184)
asked whether list virtualization composes with the demo's SSR / client / RSC
variants and at what cost. The measured answer — including the
`/restaurant/:id/ssr-virtual` and `/restaurant/:id/rsc-virtual` routes, the
per-shape costs, the `verify:rsc` red-team, and the decision table — lives in
[`docs/react-virtuoso-rsc-benchmark.md`](./docs/react-virtuoso-rsc-benchmark.md).

---

## ShakaPerf A/B Testing

[ShakaPerf](https://github.com/shakacode/shakaperf) compares two code versions
under paired simultaneous sampling. Both sides run on the same machine, and
each measurement pair fires both sides at the same instant, cancelling shared
noise (network jitter, OS scheduling, thermal throttling). The result is a
statistically gated verdict per metric: **regression**, **improvement**, or
**no difference**.

### Prerequisites

```bash
# Verify all required tools
pnpm perf:preflight

# Install Playwright browser (first time only)
pnpm exec playwright install chromium
```

**Platform:** macOS and Linux only (native addon via node-gyp). Windows is not
supported.

### Single-Target Audit

Point ShakaPerf at one running server to get a combined performance,
accessibility, visual, and bundle-size report:

```bash
# Against a running server on the default port
pnpm perf:audit

# Against a specific URL
pnpm perf:audit -- --url http://localhost:3001
```

Results are written to `audit-results/`.

### Branch vs Main Comparison

Start both servers yourself (one on the current branch, one on main), then run:

```bash
pnpm perf:compare
```

This uses `controlURL` / `experimentURL` from `abtests.config.ts` (defaults to
ports 4020/4030). Override with:

```bash
pnpm perf:compare -- --controlURL http://localhost:3000 --experimentURL http://localhost:3001
```

### Two-Commit Comparison

Automatically provisions two worktree servers and compares:

```bash
# Branch vs main
pnpm perf:compare:commits main feature-branch

# Two arbitrary SHAs
pnpm perf:compare:commits abc1234 def5678
```

The script creates temporary worktrees, builds both sides, starts co-located
servers, runs paired sampling, and cleans up. Both sides share the same
database (D3 — shared read-only DB for identical data by construction).

### Configuration

`abtests.config.ts` controls:

- **Ports**: default 4020 (control) / 4030 (experiment), overridable via
  `SHAKAPERF_CONTROL_PORT` / `SHAKAPERF_EXPERIMENT_PORT`
- **Viewports**: desktop only by default
- **Measurements**: 20 per test per viewport
- **Thresholds**: p < 0.05, regression threshold 50ms, estimator stat
- **Sampling mode**: simultaneous (paired)

### A/B Test Files

Tests live in `ab-tests/*.abtest.ts`. Each file defines one Playwright scenario
using `abTest(name, { startingPath }, async () => { … })` from `shaka-shared`.
The same test runs on both the control and experiment servers.

Style rules: fail loudly (no `try`/`catch` swallowing), run linearly (no
loops), no `if`-branching on page state, assert via `waitForSelector` /
`waitForURL`, wait on conditions not the clock, deterministic inputs,
`annotate('…')` before each non-trivial action, one behaviour per test.

### Reading Results

- **HTML**: `compare-results/self-contained-performance-report.html` (shareable,
  self-contained) and `compare-results/full-report.html`
- **JSON**: `compare-results/report.json` (`schemaVersion: 1`) — see the issue
  for the schema contract.
- **Chips**: `regression`, `improvement`, `no difference`, `broken`, `flaky`,
  `visual change`, `accessibility regression`, etc.

**Known limitation**: per-stage `summary` objects in JSON reports are still
empty placeholders (shakaperf#68). Numeric p-values, estimates, and confidence
intervals are in the HTML report and per-test artifact directories.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean — no regressions |
| 1 | Pipeline completed with failures (stderr carries `FAILED:` summary) |
| 75 | Transient proxied-menu state — retry (`EX_TEMPFAIL`) |
| Other | Harness/config problem, not a test verdict |

### Bundle Size Diffing

`shaka-bundle-size` (included as a dev dependency) complements the existing
`scripts/measure-bundle-sizes.mjs`. Both tools remain available:

- `scripts/measure-bundle-sizes.mjs` — absolute bundle sizes per loadable chunk
- `shaka-bundle-size` — used by ShakaPerf internally for A/B bundle delta
  reporting as part of the compare pipeline

### CI Integration

Deferred. Upstream GitHub Actions support (shakaperf#76) and PR-comment reporter
(shakaperf#77) are open WIP. When those land, add a non-blocking workflow.

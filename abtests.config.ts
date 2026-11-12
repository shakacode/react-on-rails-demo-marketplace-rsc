import * as os from 'node:os';
import { BrowserContext } from 'playwright-core';
import { defineConfig, assignPortsAutomatically, installRequestBlocking, DESKTOP_VIEWPORT, PHONE_VIEWPORT } from 'shaka-shared';

// Control/experiment host ports. Chosen to avoid collisions with this repo's
// dev ports: Rails 3000/3001, altports 3100, renderer 3800.
// The same pair feeds the URLs below, so they can't drift.
let CONTROL_PORT: number;
let EXPERIMENT_PORT: number;

const pinnedControl = Number(process.env.SHAKAPERF_CONTROL_PORT);
const pinnedExperiment = Number(process.env.SHAKAPERF_EXPERIMENT_PORT);
const conductorBase = Number(process.env.CONDUCTOR_PORT);
if (pinnedControl > 0 && pinnedExperiment > 0) {
  CONTROL_PORT = pinnedControl;
  EXPERIMENT_PORT = pinnedExperiment;
} else if (conductorBase > 0) {
  CONTROL_PORT = conductorBase;
  EXPERIMENT_PORT = conductorBase + 1;
} else {
  // Auto-assign starting from ports that avoid this repo's dev range.
  // If either port is in use, BOTH shift up together; the pair is remembered
  // per project in ~/.shaka-perf/ports.json.
  ({ control: CONTROL_PORT, experiment: EXPERIMENT_PORT } =
    assignPortsAutomatically({ control: 4020, experiment: 4030 }));
}

const PARALLELISM = Math.max(1, Math.floor(os.cpus().length / 2));

// Raw Lighthouse flags shared by `perf` and `audit` pipelines.
const LIGHTHOUSE_CONFIG = {
  throttling: {
    rttMs: 150,
    throughputKbps: 1638.4,
    requestLatencyMs: 562.5,
    downloadThroughputKbps: 1474.56,
    uploadThroughputKbps: 675,
    cpuSlowdownMultiplier: 4,
  },
  throttlingMethod: 'devtools' as const,
  logLevel: 'error' as const,
  output: 'html' as const,
  onlyCategories: ['performance'],
  maxWaitForLoad: 60_000,
  networkQuietThresholdMs: 1000,
  cpuQuietThresholdMs: 1000,
};

export default defineConfig({
  shared: {
    controlURL: `http://localhost:${CONTROL_PORT}`,
    experimentURL: `http://localhost:${EXPERIMENT_PORT}`,
    viewportDefinitions: [DESKTOP_VIEWPORT, PHONE_VIEWPORT],
    // Run desktop only by default to keep measurement time reasonable.
    // Add 'phone' to widen coverage once the harness is validated.
    viewports: ['desktop'],
    parallelism: PARALLELISM,
    beforeNavigate: async (options: { context: BrowserContext }) => {
      // Block reCAPTCHA to avoid flaky third-party network requests.
      await installRequestBlocking(options.context, ['/recaptcha/']);
    },
    playwrightOptions: {
      browser: 'chromium',
      args: ['--no-sandbox'],
      waitTimeout: 60_000,
    },
    browserConsole: {
      failOn: ['error'],
      // Known harmless warnings from third-party scripts and React dev mode.
      allowList: [
        'Download the React DevTools',
        'ReactDOM.render is no longer supported',
      ],
    },
  },

  visreg: {
    viewports: ['desktop', 'phone'],
    mismatchThreshold: 0.1,
    maxNumDiffPixels: 50,
    comparePixelmatchThreshold: 0.1,
  },

  perf: {
    numberOfMeasurements: 20,
    regressionThreshold: 50,
    pValueThreshold: 0.05,
    regressionThresholdStat: 'estimator',
    samplingMode: 'simultaneous',
    lighthouseConfig: LIGHTHOUSE_CONFIG,
  },

  audit: {
    lighthouseConfig: LIGHTHOUSE_CONFIG,
  },

  // Twin-servers (Docker A/B) — deferred per D1(c). When the Docker path is
  // added later, uncomment and point `dockerfile` at `.controlplane/Dockerfile`.
  // twinServers: { ... },
});

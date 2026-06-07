const path = require('path');

const { env } = process;

const { reactOnRailsProNodeRenderer } = require('react-on-rails-pro-node-renderer');

const config = {
  // Path to store server bundles cache
  serverBundleCachePath: path.resolve(__dirname, '.node-renderer-bundles'),

  // Listen at RENDERER_PORT env value or default port 3800
  port: env.RENDERER_PORT || 3800,

  // Log level: 'debug', 'info', 'warn', 'error'
  logLevel: env.RENDERER_LOG_LEVEL || 'info',

  // Password for authentication (should match react_on_rails_pro.rb config)
  // In production, use environment variables
  password: env.RENDERER_PASSWORD || 'development_password',

  // Number of worker processes (defaults to CPU count - 1)
  workersCount: env.RENDERER_WORKERS_COUNT ? parseInt(env.RENDERER_WORKERS_COUNT, 10) : 2,

  // Time in minutes between restarting all workers (to clear memory leaks)
  allWorkersRestartInterval: env.RENDERER_ALL_WORKERS_RESTART_INTERVAL || 60,

  // Time in minutes between each worker restarting when restarting all workers
  delayBetweenIndividualWorkerRestarts: 1,

  // Enable NodeJS modules support in the VM context
  // Required for loadable components and async operations
  supportModules: true,

  // Additional NodeJS modules to add to the VM context. REDIS_URL may include
  // credentials, so keep this context limited to trusted server-side RSC code.
  // ioredis stays external; initRedisCache is the only bundle module expected to use this URL.
  // Redis caching also requires RSC_CACHE_ENABLED=true when building the RSC bundle.
  additionalContext: { URL, AbortController, performance, __REDIS_URL__: env.REDIS_URL || '' },

  // Set to false to use real timers (required for setTimeout, setInterval)
  stubTimers: false,

  // Replay console logs from async server operations
  replayServerAsyncOperationLogs: true,
};

// Reduce workers in CI environment
if (env.CI) {
  config.workersCount = 2;
  config.allWorkersRestartInterval = 2;
  config.delayBetweenIndividualWorkerRestarts = 0.01;
}

reactOnRailsProNodeRenderer(config);

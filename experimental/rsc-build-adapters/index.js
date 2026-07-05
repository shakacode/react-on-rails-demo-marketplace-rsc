const released = require('./released');
const routeEntryExperiment = require('./route-entry');

const adapters = {
  released,
  'route-entry-experiment': routeEntryExperiment,
};

const DEFAULT_ADAPTER = 'released';
const ENV_NAME = 'RSC_BUILD_ADAPTER';

function getRscBuildAdapter(options = {}) {
  const name = process.env[ENV_NAME] || DEFAULT_ADAPTER;
  const adapterFactory = adapters[name];

  if (!adapterFactory) {
    throw new Error(
      `Unknown ${ENV_NAME}="${name}". Available adapters: ${Object.keys(adapters).join(', ')}`,
    );
  }

  return adapterFactory.createAdapter({
    ...options,
    name,
    envName: ENV_NAME,
  });
}

module.exports = {
  DEFAULT_ADAPTER,
  ENV_NAME,
  getRscBuildAdapter,
};

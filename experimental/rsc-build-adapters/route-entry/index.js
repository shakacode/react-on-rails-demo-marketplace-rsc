const path = require('path');
const { analyzeRouteEntries, writeGeneratedRouteEntries } = require('./analyzer');
const { ExperimentalRouteEntryRSCPlugin } = require('./plugin');

function createAdapter(options) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const routeEntryDirectoryName = process.env.RSC_ROUTE_ENTRY_DIRECTORY || 'startup';
  let analysis;

  const getAnalysis = () => {
    if (!analysis) {
      analysis = analyzeRouteEntries({
        projectRoot,
        routeEntryDirectoryName,
      });
      writeGeneratedRouteEntries(analysis);
    }

    return analysis;
  };

  const createPlugin = ({ bundlerName, isServer, releasedPluginOptions }) =>
    new ExperimentalRouteEntryRSCPlugin({
      bundlerName,
      isServer,
      projectRoot,
      analysis: getAnalysis(),
      releasedPluginOptions,
    });

  return {
    name: options.name,

    configureClientConfig(config) {
      const routeAnalysis = getAnalysis();
      if (!config.entry || typeof config.entry !== 'object' || Array.isArray(config.entry)) {
        throw new Error(
          'route-entry-experiment requires an object-shaped bundler entry configuration.',
        );
      }

      for (const route of Object.values(routeAnalysis.routes)) {
        config.entry[route.generatedEntryName] = route.generatedEntryFile;
      }
    },

    createWebpackPlugin({ isServer, releasedPluginOptions }) {
      return createPlugin({ bundlerName: 'webpack', isServer, releasedPluginOptions });
    },

    createRspackPlugin({ isServer, releasedPluginOptions }) {
      return createPlugin({ bundlerName: 'rspack', isServer, releasedPluginOptions });
    },

    getLoader() {
      return path.join(__dirname, 'loader.js');
    },
  };
}

module.exports = {
  createAdapter,
};

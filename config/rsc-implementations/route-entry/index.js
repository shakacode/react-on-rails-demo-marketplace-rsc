const path = require('path');
const { analyzeRouteEntries, writeGeneratedRouteEntries } = require('./analyzer');
const { ExperimentalRouteEntryRSCPlugin } = require('./plugin');

function createRouteEntryImplementation(options) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const bundlerName = options.bundlerName;
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

  const createPlugin = ({ isServer, releasedPluginOptions }) =>
    new ExperimentalRouteEntryRSCPlugin({
      bundlerName,
      isServer,
      projectRoot,
      analysis: getAnalysis(),
      releasedPluginOptions,
    });

  return {
    rscLoader: path.join(__dirname, 'loader.js'),
    supportsServerComponentCssManifest: false,

    configureClientConfig(config) {
      const routeAnalysis = getAnalysis();
      if (!config.entry || typeof config.entry !== 'object' || Array.isArray(config.entry)) {
        throw new Error(
          'route_entry requires an object-shaped bundler entry configuration.',
        );
      }

      for (const route of Object.values(routeAnalysis.routes)) {
        config.entry[route.generatedEntryName] = route.generatedEntryFile;
      }
    },

    createClientPlugin(releasedPluginOptions) {
      return createPlugin({ isServer: false, releasedPluginOptions });
    },

    createServerPlugin(releasedPluginOptions) {
      return createPlugin({ isServer: true, releasedPluginOptions });
    },
  };
}

module.exports = {
  createRouteEntryImplementation,
};

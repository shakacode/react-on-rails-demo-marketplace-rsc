const path = require('node:path');
const { RSCWebpackPlugin } = require('react-on-rails-rsc/WebpackPlugin');
const { RSCRspackPlugin } = require('react-on-rails-rsc/RspackPlugin');
const { RSCModuleGraphPlugin } = require('./module-graph/webpack-plugin');
const { createRouteEntryImplementation } = require('./route-entry');

const DEFAULT_IMPLEMENTATION_ID = 'release';
const MODULE_GRAPH_IMPLEMENTATION_ID = 'module_graph';
const ROUTE_ENTRY_IMPLEMENTATION_ID = 'route_entry';

const moduleGraphLoaderPath = path.resolve(__dirname, './module-graph/loader.js');
const moduleGraphWebpackClientReferences = require('../webpack/rscClientReferences');
const projectRoot = path.resolve(__dirname, '../..');

const rspackDefaultClientReferences = [
  {
    directory: './app/javascript',
    recursive: true,
    include: /\.[cm]?[jt]sx?$/,
  },
];

const implementations = {
  [DEFAULT_IMPLEMENTATION_ID]: {
    id: DEFAULT_IMPLEMENTATION_ID,
    label: 'Released react-on-rails-rsc plugin + loader',
    webpack: {
      configureClientConfig() {},
      createClientPlugin(options) {
        return new RSCWebpackPlugin({ isServer: false, ...options });
      },
      createServerPlugin(options) {
        return new RSCWebpackPlugin({ isServer: true, ...options });
      },
      rscLoader: 'react-on-rails-rsc/WebpackLoader',
      supportsServerComponentCssManifest: false,
    },
    rspack: {
      configureClientConfig() {},
      createClientPlugin(options) {
        return new RSCRspackPlugin({ isServer: false, ...options });
      },
      createServerPlugin(options) {
        return new RSCRspackPlugin({ isServer: true, ...options });
      },
      rscLoader: 'react-on-rails-rsc/WebpackLoader',
      supportsServerComponentCssManifest: false,
    },
  },
  [MODULE_GRAPH_IMPLEMENTATION_ID]: {
    id: MODULE_GRAPH_IMPLEMENTATION_ID,
    label: 'Issue #130 experimental module-graph plugin + local loader wrapper',
    webpack: {
      configureClientConfig() {},
      createClientPlugin(options) {
        return new RSCModuleGraphPlugin({ isServer: false, ...options });
      },
      createServerPlugin(options) {
        return new RSCModuleGraphPlugin({ isServer: true, ...options });
      },
      rscLoader: moduleGraphLoaderPath,
      supportsServerComponentCssManifest: true,
    },
  },
  [ROUTE_ENTRY_IMPLEMENTATION_ID]: {
    id: ROUTE_ENTRY_IMPLEMENTATION_ID,
    label: 'Issue #131 experimental route-entry benchmark plugin + local loader wrapper',
    webpack: createRouteEntryImplementation({
      bundlerName: 'webpack',
      projectRoot,
    }),
    rspack: createRouteEntryImplementation({
      bundlerName: 'rspack',
      projectRoot,
    }),
  },
};

function getRscBuildImplementationId() {
  return process.env.RSC_BUILD_IMPLEMENTATION || DEFAULT_IMPLEMENTATION_ID;
}

function getRscBuildImplementation(bundler) {
  const implementationId = getRscBuildImplementationId();
  const implementation = implementations[implementationId];

  if (!implementation) {
    throw new Error(
      `Unknown RSC_BUILD_IMPLEMENTATION "${implementationId}". Supported values: ${Object.keys(implementations).join(', ')}`,
    );
  }

  const bundlerImplementation = implementation[bundler];
  if (!bundlerImplementation) {
    throw new Error(
      `RSC_BUILD_IMPLEMENTATION="${implementationId}" is not available for ${bundler}. ` +
        `Currently available: ${Object.keys(implementation).filter((key) => ['webpack', 'rspack'].includes(key)).join(', ')}`,
    );
  }

  return { implementationId, label: implementation.label, ...bundlerImplementation };
}

function getWebpackRscImplementation() {
  return getRscBuildImplementation('webpack');
}

function getRspackRscImplementation() {
  return getRscBuildImplementation('rspack');
}

module.exports = {
  DEFAULT_IMPLEMENTATION_ID,
  MODULE_GRAPH_IMPLEMENTATION_ID,
  ROUTE_ENTRY_IMPLEMENTATION_ID,
  getRscBuildImplementationId,
  getWebpackRscImplementation,
  getRspackRscImplementation,
  implementations,
  moduleGraphWebpackClientReferences,
  rspackDefaultClientReferences,
};

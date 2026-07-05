const LoadablePlugin = require('@loadable/webpack-plugin');
const path = require('path');
const commonWebpackConfig = require('./commonWebpackConfig');
const rscClientReferenceOptions = require('./rscClientReferences');
const { getRscBuildAdapter } = require('../../experimental/rsc-build-adapters');

const isHMR = process.env.HMR;
const rscBuildAdapter = getRscBuildAdapter({ projectRoot: path.resolve(__dirname, '../..') });

// Override CSS Modules configuration to use v8-style default exports
const overrideCssModulesConfig = (config) => {
  // Find the CSS rule in the module rules
  const cssRule = config.module.rules.find(
    (rule) => rule.test && rule.test.toString().includes("css")
  )

  if (cssRule && cssRule.use) {
    const cssLoaderUse = cssRule.use.find(
      (use) => use.loader && use.loader.includes("css-loader")
    )

    if (cssLoaderUse) {
      cssRule.use.push({
        loader: "postcss-loader",
        options: {
          postcssOptions: {
            plugins: [
              [
                "postcss-preset-env",
                {
                  // Options
                },
              ],
            ],
          },
        },
      })
    }
  }

  return config
}

const configureClient = () => {
  const clientConfig = commonWebpackConfig();

  // server-bundle is special and should ONLY be built by the serverConfig
  // In case this entry is not deleted, a very strange "window" not found
  // error shows referring to window["webpackJsonp"]. That is because the
  // client config is going to try to load chunks.
  delete clientConfig.entry['server-bundle'];

  rscBuildAdapter.configureClientConfig(clientConfig);
  clientConfig.plugins.push(
    rscBuildAdapter.createWebpackPlugin({
      isServer: false,
      releasedPluginOptions: rscClientReferenceOptions,
    }),
  );

  if (!isHMR) {
    clientConfig.plugins.unshift(new LoadablePlugin({ filename: 'loadable-stats.json', writeToDisk: true }));
  }

  clientConfig.resolve.fallback = {
    fs: false,
    path: false,
    stream: false,
  };

  // Isolate heavy markdown/syntax-highlighting libraries into their own chunk.
  // Without this, webpack's default `defaultVendors` cacheGroup bundles marked +
  // highlight.js into the same shared vendor chunk as React. RSC client components
  // (InteractiveSection, BookmarkShareBar, etc.) need React, so they'd pull in
  // the entire vendor chunk — including ~350KB of markdown libraries they never use.
  // By giving this group higher priority than defaultVendors (-10), webpack splits
  // these libraries into a separate chunk that only SSR/Client pages load.
  const splitChunks = clientConfig.optimization.splitChunks || {};
  splitChunks.cacheGroups = {
    ...splitChunks.cacheGroups,
    markdownLibs: {
      test: /[\\/]node_modules[\\/](marked|highlight\.js|marked-highlight)[\\/]/,
      name: 'markdown-libs',
      chunks: 'all',
      priority: 10,
      enforce: true,
    },
    // Isolate d3 charting + date-fns into their own chunk.
    // Same strategy as markdownLibs: these heavy libraries (d3 ~80KB + date-fns ~30KB)
    // are only needed for SSR/Client dashboard pages. RSC renders charts server-side
    // and only ships SVG to the client, so this chunk is never loaded on RSC pages.
    chartingLibs: {
      test: /[\\/]node_modules[\\/](d3-scale|d3-shape|d3-array|d3-time-format|d3-time|d3-format|d3-interpolate|d3-color|d3-path|internmap|date-fns)[\\/]/,
      name: 'charting-libs',
      chunks: 'all',
      priority: 10,
      enforce: true,
    },
  };
  clientConfig.optimization.splitChunks = splitChunks;

  return overrideCssModulesConfig(clientConfig);
};

module.exports = configureClient;

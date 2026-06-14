const { RSCRspackPlugin } = require('react-on-rails-rsc/RspackPlugin');
const { CssExtractRspackPlugin } = require('@rspack/core');
const { getPlugins: getRspackPlugins } = require('shakapacker/package/plugins/rspack.js');
const commonRspackConfig = require('./commonRspackConfig');

const isHMR = process.env.HMR;

const normalizeRspackPlugins = (config) => {
  const generatedAssetPluginNames = new Set([
    'EnvironmentPlugin',
    'CssExtractRspackPlugin',
    'MiniCssExtractPlugin',
    'WebpackManifestPlugin',
    'WebpackAssetsManifest',
  ]);

  config.plugins = [
    ...getRspackPlugins(),
    ...config.plugins.filter((plugin) => !generatedAssetPluginNames.has(plugin?.constructor?.name)),
  ];

  config.module.rules.forEach((rule) => {
    if (!Array.isArray(rule.use)) return;

    const updatedUse = rule.use.map((use) => {
      const loader = typeof use === 'string' ? use : use.loader;
      if (!loader?.includes('mini-css-extract-plugin')) return use;

      rule.type = 'javascript/auto';
      return CssExtractRspackPlugin.loader;
    });

    rule.use = updatedUse;
  });

  return config;
};

const overrideCssModulesConfig = (config) => {
  const cssRule = config.module.rules.find(
    (rule) => rule.test && rule.test.toString().includes("css")
  );

  if (cssRule && cssRule.use) {
    const cssLoaderUse = cssRule.use.find(
      (use) => use.loader && use.loader.includes("css-loader")
    );

    if (cssLoaderUse) {
      cssRule.use.push({
        loader: "postcss-loader",
        options: {
          postcssOptions: {
            plugins: [
              [
                "postcss-preset-env",
                {},
              ],
            ],
          },
        },
      });
    }
  }

  return config;
};

const configureClient = () => {
  const clientConfig = commonRspackConfig();

  // server-bundle should ONLY be built by the serverConfig
  delete clientConfig.entry['server-bundle'];

  clientConfig.plugins.push(new RSCRspackPlugin({
    isServer: false,
    clientReferences: [
      {
        directory: './app/javascript',
        recursive: true,
        include: /\.[cm]?[jt]sx?$/,
      },
    ],
  }));

  // Skip @loadable/webpack-plugin for now — it may not be compatible with rspack v2.
  // RSC pages don't need it (they use server-side rendering for code splitting).
  // We can add it later if SSR/Client pages need it.

  clientConfig.resolve.fallback = {
    fs: false,
    path: false,
    stream: false,
  };

  clientConfig.optimization.runtimeChunk = 'single';

  const splitChunks = clientConfig.optimization.splitChunks || {};
  splitChunks.chunks = 'all';
  splitChunks.cacheGroups = {
    ...splitChunks.cacheGroups,
    markdownLibs: {
      test: /[\\/]node_modules[\\/](marked|highlight\.js|marked-highlight)[\\/]/,
      name: 'markdown-libs',
      chunks: 'all',
      priority: 10,
      enforce: true,
    },
    chartingLibs: {
      test: /[\\/]node_modules[\\/](d3-scale|d3-shape|d3-array|d3-time-format|d3-time|d3-format|d3-interpolate|d3-color|d3-path|internmap|date-fns)[\\/]/,
      name: 'charting-libs',
      chunks: 'all',
      priority: 10,
      enforce: true,
    },
  };
  clientConfig.optimization.splitChunks = splitChunks;

  return normalizeRspackPlugins(overrideCssModulesConfig(clientConfig));
};

module.exports = configureClient;

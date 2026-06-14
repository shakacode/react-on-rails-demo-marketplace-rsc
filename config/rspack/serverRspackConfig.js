/* eslint-disable no-param-reassign */
const { RSCRspackPlugin } = require('react-on-rails-rsc/RspackPlugin');
const rspack = require('@rspack/core');
const path = require('path');
const commonRspackConfig = require('./commonRspackConfig');

function extractLoader(rule, loaderName) {
  if (!Array.isArray(rule.use)) return undefined;
  return rule.use.find((item) => {
    let testValue;

    if (typeof item === 'string') {
      testValue = item;
    } else if (typeof item.loader === 'string') {
      testValue = item.loader;
    }

    return testValue && testValue.includes(loaderName);
  });
}

const configureServer = (rscBundle = false) => {
  const serverConfig = commonRspackConfig();

  const serverEntry = {
    'server-bundle': serverConfig.entry['server-bundle'],
  };

  if (!serverEntry['server-bundle']) {
    throw new Error(
      "Create a pack with the file name 'server-bundle.js' containing all the server rendering files",
    );
  }

  serverConfig.entry = serverEntry;

  // Remove CSS extraction plugin loaders from server build
  serverConfig.module.rules.forEach((loader) => {
    if (loader.use && loader.use.filter) {
      loader.use = loader.use.filter(
        (item) => {
          if (typeof item === 'string') {
            return !item.match(/mini-css-extract-plugin/) && !item.match(/CssExtractRspackPlugin/);
          }
          if (typeof item === 'object' && item.loader) {
            return !item.loader.match(/mini-css-extract-plugin/) && !item.loader.match(/CssExtractRspackPlugin/);
          }
          return true;
        },
      );
    }
  });

  serverConfig.optimization = {
    minimize: false,
  };

  if (!rscBundle) {
    serverConfig.plugins.push(new RSCRspackPlugin({
      isServer: true,
      clientReferences: [
        {
          directory: './app/javascript',
          recursive: true,
          include: /\.[cm]?[jt]sx?$/,
        },
      ],
    }));
  }

  if (rspack.optimize?.LimitChunkCountPlugin) {
    serverConfig.plugins.unshift(new rspack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }));
  }

  serverConfig.plugins.push(
    new rspack.DefinePlugin({
      'process.env.REACT_ON_RAILS_RSC_BUNDLE': JSON.stringify(rscBundle ? 'true' : 'false'),
      'process.env.RSC_CACHE_ENABLED': JSON.stringify(process.env.RSC_CACHE_ENABLED || 'false'),
      'process.env.RSC_L1_CACHE_MAX_ENTRIES': JSON.stringify(process.env.RSC_L1_CACHE_MAX_ENTRIES || '50'),
    }),
  );

  serverConfig.output = {
    filename: 'server-bundle.js',
    globalObject: 'this',
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, '../../ssr-generated'),
  };

  // Remove plugins not needed for server bundle
  serverConfig.plugins = serverConfig.plugins.filter(
    (plugin) =>
      plugin.constructor.name !== 'WebpackAssetsManifest' &&
      plugin.constructor.name !== 'WebpackManifestPlugin' &&
      plugin.constructor.name !== 'RspackManifestPlugin' &&
      plugin.constructor.name !== 'MiniCssExtractPlugin' &&
      plugin.constructor.name !== 'CssExtractRspackPlugin' &&
      plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin',
  );

  const { rules } = serverConfig.module;
  rules.forEach((rule) => {
    if (Array.isArray(rule.use)) {
      rule.use = rule.use.filter((item) => {
        let testValue;
        if (typeof item === 'string') {
          testValue = item;
        } else if (typeof item.loader === 'string') {
          testValue = item.loader;
        }
        if (!testValue) return true;
        return !(testValue.match(/mini-css-extract-plugin/) || testValue.match(/CssExtractRspackPlugin/) || testValue === 'style-loader');
      });
      const cssLoader = extractLoader(rule, 'css-loader');
      if (cssLoader && cssLoader.options) {
        cssLoader.options.modules = { exportOnlyLocals: true };
      }

      const babelLoader = extractLoader(rule, 'babel-loader');
      if (babelLoader) {
        babelLoader.options.caller = { ssr: true };
      }
    } else if (rule.use && (rule.use.loader === 'url-loader' || rule.use.loader === 'file-loader')) {
      rule.use.options.emitFile = false;
    }
  });

  serverConfig.devtool = 'eval';
  serverConfig.target = 'node';
  serverConfig.node = false;
  return serverConfig;
};

module.exports = {
  default: configureServer,
  extractLoader,
};

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { devServer, inliningCss } = require('shakapacker/rspack');

const rspackConfig = require('./ServerClientOrBoth');

const developmentEnvOnly = (clientConfig, _serverConfig) => {
  if (inliningCss) {
    try {
      const reactRefreshPlugin = require('@rspack/plugin-react-refresh');
      // v1 exported the constructor directly; v2 returns a namespace with this named export.
      const ReactRefreshPlugin =
        reactRefreshPlugin.ReactRefreshRspackPlugin || reactRefreshPlugin.default || reactRefreshPlugin;
      if (typeof ReactRefreshPlugin !== 'function') {
        throw new TypeError('@rspack/plugin-react-refresh did not export a plugin constructor');
      }
      clientConfig.plugins.push(new ReactRefreshPlugin());
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        console.warn(`Skipping React Refresh: ${error.message}`);
      }
    }
  }
};

module.exports = rspackConfig(developmentEnvOnly);

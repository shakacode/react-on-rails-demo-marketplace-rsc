process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { devServer, inliningCss } = require('shakapacker/rspack');

const rspackConfig = require('./ServerClientOrBoth');

const developmentEnvOnly = (clientConfig, _serverConfig) => {
  if (inliningCss) {
    try {
      const reactRefreshPlugin = require('@rspack/plugin-react-refresh');
      const ReactRefreshPlugin =
        reactRefreshPlugin.ReactRefreshRspackPlugin || reactRefreshPlugin.default || reactRefreshPlugin;
      clientConfig.plugins.push(new ReactRefreshPlugin());
    } catch {
      // @rspack/plugin-react-refresh not installed, skip
    }
  }
};

module.exports = rspackConfig(developmentEnvOnly);

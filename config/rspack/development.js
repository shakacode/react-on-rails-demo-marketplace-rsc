process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { devServer, inliningCss } = require('shakapacker/rspack');

const rspackConfig = require('./ServerClientOrBoth');

const developmentEnvOnly = (clientConfig, _serverConfig) => {
  if (inliningCss) {
    try {
      const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');
      clientConfig.plugins.push(
        new ReactRefreshPlugin(),
      );
    } catch {
      // @rspack/plugin-react-refresh not installed, skip
    }
  }
};

module.exports = rspackConfig(developmentEnvOnly);

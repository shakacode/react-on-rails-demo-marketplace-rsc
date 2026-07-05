function createAdapter({ name }) {
  return {
    name,

    configureClientConfig() {
      // The released adapter leaves the app's normal entry graph untouched.
    },

    createWebpackPlugin({ isServer, releasedPluginOptions }) {
      const { RSCWebpackPlugin } = require('react-on-rails-rsc/WebpackPlugin');
      return new RSCWebpackPlugin({ isServer, ...releasedPluginOptions });
    },

    createRspackPlugin({ isServer, releasedPluginOptions }) {
      const { RSCRspackPlugin } = require('react-on-rails-rsc/RspackPlugin');
      return new RSCRspackPlugin({ isServer, ...releasedPluginOptions });
    },

    getLoader() {
      return 'react-on-rails-rsc/WebpackLoader';
    },
  };
}

module.exports = {
  createAdapter,
};

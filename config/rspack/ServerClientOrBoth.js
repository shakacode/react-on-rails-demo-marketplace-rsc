const clientRspackConfig = require('./clientRspackConfig');
const { default: serverRspackConfig } = require('./serverRspackConfig');
const rscRspackConfig = require('./rscRspackConfig');

const rspackConfig = (envSpecific) => {
  const clientConfig = clientRspackConfig();
  const serverConfig = serverRspackConfig();
  const rscConfig = rscRspackConfig();

  if (envSpecific) {
    envSpecific(clientConfig, serverConfig);
  }

  let result;
  if (process.env.WEBPACK_SERVE || process.env.CLIENT_BUNDLE_ONLY) {
    console.log('[React on Rails] Creating only the client bundles (rspack).');
    result = clientConfig;
  } else if (process.env.SERVER_BUNDLE_ONLY) {
    console.log('[React on Rails] Creating only the server bundle (rspack).');
    result = serverConfig;
  } else if (process.env.RSC_BUNDLE_ONLY) {
    console.log('[React on Rails] Creating only the RSC bundle (rspack).');
    result = rscConfig;
  } else {
    console.log('[React on Rails] Creating both client and server bundles (rspack).');
    result = [clientConfig, serverConfig, rscConfig];
  }

  return result;
};

module.exports = rspackConfig;

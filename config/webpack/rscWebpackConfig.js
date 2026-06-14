const { default: serverWebpackConfig, extractLoader } = require('./serverWebpackConfig');
const addIoredisExternal = require('../shared/addIoredisExternal');

const configureRsc = () => {
  const rscConfig = serverWebpackConfig(true);
  const serverBundleEntry = rscConfig.entry['server-bundle'];

  // Update the entry name to be `rsc-bundle` instead of `server-bundle`
  const rscEntry = {
    'rsc-bundle': [
      './app/javascript/utils/initRedisCache.ts',
      ...(Array.isArray(serverBundleEntry) ? serverBundleEntry : [serverBundleEntry]),
    ],
  };
  rscConfig.entry = rscEntry;

  // Add the RSC loader to replace 'use client' modules with client references.
  // Using enforce: 'post' so it runs AFTER swc-loader compiles TSX→JS,
  // giving acorn clean JavaScript to parse.
  rscConfig.module.rules.push({
    test: /\.(ts|tsx|js|jsx|mjs)$/,
    enforce: 'post',
    loader: 'react-on-rails-rsc/WebpackLoader',
  });

  // Add the `react-server` condition to the resolve config
  // This condition is used by React and React on Rails to know that this bundle is a React Server Component bundle
  // The `...` tells webpack to retain the default Webpack conditions (In this case will keep the `node` condition because the bundle targets node)
  rscConfig.resolve = {
    ...rscConfig.resolve,
    conditionNames: ['react-server', '...'],
    alias: {
      ...rscConfig.resolve?.alias,
      // Ignore import of react-dom/server in rsc bundle
      // This module is not needed to generate the rsc payload, it's rendered using `react-on-rails-rsc`
      // Not removing it will cause a runtime error
      'react-dom/server': false,
    },
  };

  // Update the output bundle name to be `rsc-bundle.js` instead of `server-bundle.js`
  rscConfig.output.filename = 'rsc-bundle.js';
  rscConfig.externals = addIoredisExternal(rscConfig.externals);
  return rscConfig;
};

module.exports = configureRsc;

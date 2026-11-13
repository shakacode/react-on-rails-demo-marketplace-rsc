const { default: serverRspackConfig } = require('./serverRspackConfig');
const { getRspackRscImplementation } = require('../rsc-implementations');

const addIoredisExternal = require('../shared/addIoredisExternal');

const configureRsc = () => {
  const rscConfig = serverRspackConfig(true);
  const rscImplementation = getRspackRscImplementation();

  const serverBundleEntry = rscConfig.entry['server-bundle'];
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
  // .cjs is included because @apollo/client-react-streaming ships
  // SimulatePreloadedQuery.cc.cjs with 'use client' — without it the RSC
  // bundle runs the module server-side and useApolloClient() throws.
  rscConfig.module.rules.push({
    test: /\.(ts|tsx|js|jsx|mjs)$/,
    enforce: 'post',
    loader: rscImplementation.rscLoader,
  });

  // Add the `react-server` condition to the resolve config
  rscConfig.resolve = {
    ...rscConfig.resolve,
    conditionNames: ['react-server', '...'],
    alias: {
      ...rscConfig.resolve?.alias,
      'react-dom/server': false,
    },
  };

  rscConfig.output.filename = 'rsc-bundle.js';
  rscConfig.externals = addIoredisExternal(rscConfig.externals);
  return rscConfig;
};

module.exports = configureRsc;

const { default: serverRspackConfig } = require('./serverRspackConfig');
const path = require('path');
const { getRscBuildAdapter } = require('../../experimental/rsc-build-adapters');

const rscBuildAdapter = getRscBuildAdapter({ projectRoot: path.resolve(__dirname, '../..') });

const configureRsc = () => {
  const rscConfig = serverRspackConfig(true);

  const rscEntry = {
    'rsc-bundle': rscConfig.entry['server-bundle'],
  };
  rscConfig.entry = rscEntry;

  // Add the RSC loader to replace 'use client' modules with client references.
  // Using enforce: 'post' so it runs AFTER swc-loader compiles TSX→JS,
  // giving acorn clean JavaScript to parse.
  rscConfig.module.rules.push({
    test: /\.(ts|tsx|js|jsx|mjs)$/,
    enforce: 'post',
    loader: rscBuildAdapter.getLoader({ bundlerName: 'rspack' }),
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
  return rscConfig;
};

module.exports = configureRsc;

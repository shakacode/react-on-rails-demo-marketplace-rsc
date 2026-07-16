const releasedLoaderModule = require('react-on-rails-rsc/WebpackLoader');
const releasedLoader = releasedLoaderModule.default || releasedLoaderModule;

module.exports = function experimentalRouteEntryRscLoader(source, inputSourceMap, meta) {
  return releasedLoader.call(this, source, inputSourceMap, meta);
};

const releaseLoader = require('react-on-rails-rsc/WebpackLoader');

module.exports = typeof releaseLoader === 'function' ? releaseLoader : releaseLoader.default;

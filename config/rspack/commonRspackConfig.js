const { generateRspackConfig, merge } = require('shakapacker/rspack');

const commonOptions = {
  resolve: {
    extensions: ['.css', '.ts', '.tsx'],
  },
};

const baseRspackConfig = generateRspackConfig();

const commonRspackConfig = () => merge({}, baseRspackConfig, commonOptions);

module.exports = commonRspackConfig;

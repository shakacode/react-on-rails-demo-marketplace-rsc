const { generateRspackConfig, merge } = require('shakapacker/rspack');
const { EnvironmentPlugin } = require('@rspack/core');

const commonOptions = {
  resolve: {
    extensions: ['.css', '.ts', '.tsx'],
  },
};

const baseRspackConfig = generateRspackConfig();

const normalizeRspackEnvironmentPlugin = (config) => {
  config.plugins = config.plugins.map((plugin) => {
    if (plugin?.constructor?.name !== 'EnvironmentPlugin') return plugin;

    return new EnvironmentPlugin(plugin.defaultValues || plugin.keys);
  });

  return config;
};

const commonRspackConfig = () => normalizeRspackEnvironmentPlugin(merge({}, baseRspackConfig, commonOptions));

module.exports = commonRspackConfig;

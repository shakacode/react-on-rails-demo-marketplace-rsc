const { generateRspackConfig, merge } = require('shakapacker/rspack');
const { EnvironmentPlugin } = require('@rspack/core');

const commonOptions = {
  resolve: {
    extensions: ['.css', '.ts', '.tsx'],
  },
};

const baseRspackConfig = generateRspackConfig();

const hasEnvironmentPluginDefaultValues = (defaultValues) => {
  if (defaultValues == null) return false;
  if (Array.isArray(defaultValues)) return defaultValues.length > 0;

  return Object.keys(defaultValues).length > 0;
};

const normalizeRspackEnvironmentPlugin = (config) => {
  config.plugins = config.plugins.map((plugin) => {
    if (plugin?.constructor?.name !== 'EnvironmentPlugin') return plugin;

    const args = hasEnvironmentPluginDefaultValues(plugin.defaultValues)
      ? plugin.defaultValues
      : plugin.keys ?? plugin.defaultValues;

    if (args == null) {
      throw new Error('EnvironmentPlugin instance has neither defaultValues nor keys; cannot convert it to the Rspack equivalent');
    }

    return new EnvironmentPlugin(args);
  });

  return config;
};

const commonRspackConfig = () => normalizeRspackEnvironmentPlugin(merge({}, baseRspackConfig, commonOptions));

module.exports = commonRspackConfig;

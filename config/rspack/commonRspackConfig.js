const { generateRspackConfig, merge } = require('shakapacker/rspack');
const { EnvironmentPlugin } = require('@rspack/core');

const commonOptions = {
  resolve: {
    extensions: ['.css', '.ts', '.tsx'],
  },
};

const baseRspackConfig = generateRspackConfig();
const loadableSwcPlugin = ['@swc/plugin-loadable-components', {}];

const normalizeRspackEnvironmentPlugin = (config) => {
  config.plugins = config.plugins.map((plugin) => {
    if (plugin?.constructor?.name !== 'EnvironmentPlugin') return plugin;

    return new EnvironmentPlugin(plugin.defaultValues || plugin.keys);
  });

  return config;
};

const configureLoadableSwcPlugin = (config) => {
  config.module.rules.forEach((rule) => {
    if (!Array.isArray(rule.use)) return;

    rule.use.forEach((use) => {
      if (!use?.loader?.includes('swc-loader')) return;

      use.options ||= {};
      use.options.jsc ||= {};
      use.options.jsc.experimental ||= {};
      use.options.jsc.experimental.plugins ||= [];

      const hasLoadablePlugin = use.options.jsc.experimental.plugins.some(
        ([pluginName]) => pluginName === loadableSwcPlugin[0],
      );

      if (!hasLoadablePlugin) {
        use.options.jsc.experimental.plugins.push(loadableSwcPlugin);
      }
    });
  });

  return config;
};

const commonRspackConfig = () => configureLoadableSwcPlugin(
  normalizeRspackEnvironmentPlugin(merge({}, baseRspackConfig, commonOptions)),
);

module.exports = commonRspackConfig;

module.exports = function(api) {
  const reactCompilerEnabled = process.env.REACT_COMPILER_ENABLED === 'true';
  api.cache.using(() => `compiler:${reactCompilerEnabled}`);

  const presets = [
    ['@babel/preset-env', {
      targets: {
        browsers: ['> 1%', 'last 2 versions']
      }
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }],
    ['@babel/preset-typescript', {
      isTSX: true,
      allExtensions: true
    }]
  ];

  const plugins = ['@loadable/babel-plugin'];

  if (reactCompilerEnabled) {
    plugins.unshift(['babel-plugin-react-compiler', { target: '19' }]);
  }

  return {
    presets,
    plugins
  };
};

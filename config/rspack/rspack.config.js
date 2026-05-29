const { env } = require('shakapacker/rspack');
const { existsSync } = require('fs');
const { resolve } = require('path');

const envSpecificConfig = () => {
  const path = resolve(__dirname, `${env.nodeEnv}.js`);
  if (existsSync(path)) {
    console.log(`Loading ENV specific rspack configuration file ${path}`);
    // eslint-disable-next-line global-require,import/no-dynamic-require
    return require(path);
  }

  throw new Error(
    `Invalid NODE_ENV = ${env.nodeEnv}. Please use one of the following 'test', 'development' or 'production'.`,
  );
};

module.exports = envSpecificConfig();

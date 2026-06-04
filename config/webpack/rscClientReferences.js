const path = require('path');

module.exports = {
  clientReferences: [
    {
      directory: path.resolve(__dirname, '../../app/javascript'),
      recursive: true,
      include: /\.(js|jsx|ts|tsx)$/,
    },
  ],
};

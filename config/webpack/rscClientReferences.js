const path = require('path');

module.exports = {
  clientReferences: [
    {
      directory: path.resolve(__dirname, '../../app/javascript'),
      recursive: true,
      include: /\.(js|jsx|ts|tsx)$/,
    },
    // @apollo/client-react-streaming ships SimulatePreloadedQuery as a 'use client'
    // module (index.cc.js). The RSC loader converts it to a client reference in the
    // RSC bundle, and the client bundle must include it so the React Client Manifest
    // has the entry. Without this, PreloadQuery's transported queryRef fails to hydrate.
    //
    // Direct string paths add a single file as a client reference without directory
    // scanning — the plugin's normalizeClientReferences accepts both forms.
    path.resolve(__dirname, '../../node_modules/@apollo/client-react-streaming/dist/index.cc.js'),
  ],
};

const {
  default: serverWebpackConfig,
  extractLoader,
} = require("./serverWebpackConfig");
const { getWebpackRscImplementation } = require("../rsc-implementations");

const configureRsc = () => {
  const rscConfig = serverWebpackConfig(true);
  const rscImplementation = getWebpackRscImplementation();

  // Update the entry name to be `rsc-bundle` instead of `server-bundle`
  const rscEntry = {
    "rsc-bundle": rscConfig.entry["server-bundle"],
  };
  rscConfig.entry = rscEntry;

  // Add the RSC loader to replace 'use client' modules with client references.
  // Using enforce: 'post' so it runs AFTER swc-loader compiles TSX→JS,
  // giving acorn clean JavaScript to parse.
  // .cjs is included because @apollo/client-react-streaming ships
  // SimulatePreloadedQuery.cc.cjs with 'use client' — without it the RSC
  // bundle runs the module server-side and useApolloClient() throws.
  rscConfig.module.rules.push({
    test: /\.(ts|tsx|js|jsx|mjs)$/,
    enforce: "post",
    loader: rscImplementation.rscLoader,
  });

  // Add the `react-server` condition to the resolve config
  // This condition is used by React and React on Rails to know that this bundle is a React Server Component bundle
  // The `...` tells webpack to retain the default Webpack conditions (In this case will keep the `node` condition because the bundle targets node)
  rscConfig.resolve = {
    ...rscConfig.resolve,
    conditionNames: ["react-server", "..."],
    alias: {
      ...rscConfig.resolve?.alias,
      // Ignore import of react-dom/server in rsc bundle
      // This module is not needed to generate the rsc payload, it's rendered using `react-on-rails-rsc`
      // Not removing it will cause a runtime error
      "react-dom/server": false,
      // The RSC bundle shares the server-bundle entry, so it also sees the
      // `import 'react-on-rails-pro/pprSupport'` that registers the PPR prerender/resume
      // APIs for the SSR bundle. Under the `react-server` condition react-dom/static.node
      // resolves to a stub that throws at import time ("react-dom/static is not supported
      // in React Server Components"), so drop the registration here — PPR's prerender and
      // resume phases only ever run in the SSR bundle.
      "react-on-rails-pro/pprSupport": false,
    },
  };

  // Update the output bundle name to be `rsc-bundle.js` instead of `server-bundle.js`
  rscConfig.output.filename = "rsc-bundle.js";
  return rscConfig;
};

module.exports = configureRsc;

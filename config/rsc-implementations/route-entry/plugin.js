const path = require('path');

function serializableRoute(route, projectRoot) {
  return {
    name: route.name,
    root: route.root,
    projectRelativeRoot: route.projectRelativeRoot,
    serverModuleCount: route.serverModuleCount,
    serverCss: route.serverCss,
    clientRefs: route.clientRefs,
    generatedEntryName: route.generatedEntryName,
    generatedEntryFile: path.relative(projectRoot, route.generatedEntryFile).replace(/\\/g, '/'),
  };
}

function getBundler(compiler, bundlerName) {
  if (bundlerName === 'rspack') {
    return compiler.rspack || require('@rspack/core');
  }
  return compiler.webpack || require('webpack');
}

function collectEntrypointFiles(compilation, entryName) {
  const entrypoint = compilation.entrypoints?.get?.(entryName);
  if (!entrypoint) return { js: [], css: [], all: [] };

  const files = typeof entrypoint.getFiles === 'function'
    ? entrypoint.getFiles()
    : Array.from(entrypoint.chunks || []).flatMap((chunk) => Array.from(chunk.files || []));

  const all = Array.from(new Set(files.map(String)));
  return {
    js: all.filter((file) => /\.(?:js|mjs)$/.test(file) && !file.includes('.hot-update.')),
    css: all.filter((file) => file.endsWith('.css') && !file.endsWith('.hot-update.css')),
    all,
  };
}

class ExperimentalRouteEntryRSCPlugin {
  constructor(options) {
    this.bundlerName = options.bundlerName;
    this.isServer = options.isServer;
    this.projectRoot = options.projectRoot;
    this.analysis = options.analysis;
    this.releasedPluginOptions = options.releasedPluginOptions || {};
    this.manifestFilename = options.manifestFilename || 'react-rsc-route-entry-manifest.json';
  }

  apply(compiler) {
    const upstreamOptions = {
      ...this.releasedPluginOptions,
      isServer: this.isServer,
      clientReferences: this.analysis.clientReferences,
    };

    if (this.bundlerName === 'rspack') {
      const { RSCRspackPlugin } = require('react-on-rails-rsc/RspackPlugin');
      new RSCRspackPlugin(upstreamOptions).apply(compiler);
    } else {
      const { RSCWebpackPlugin } = require('react-on-rails-rsc/WebpackPlugin');
      new RSCWebpackPlugin(upstreamOptions).apply(compiler);
    }

    const pluginName = 'ExperimentalRouteEntryRSCPlugin';
    const bundler = getBundler(compiler, this.bundlerName);

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: bundler.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          const routes = {};
          for (const [routeName, route] of Object.entries(this.analysis.routes)) {
            routes[routeName] = {
              ...serializableRoute(route, this.projectRoot),
              ...(this.isServer
                ? {}
                : { entryFiles: collectEntrypointFiles(compilation, route.generatedEntryName) }),
            };
          }

          const payload = {
            version: 1,
            implementation: 'route_entry',
            bundler: this.bundlerName,
            isServer: this.isServer,
            routeEntryDirectoryName: this.analysis.routeEntryDirectoryName,
            routeCount: this.analysis.routeCount,
            clientReferenceCount: this.analysis.clientReferenceCount,
            clientReferences: this.analysis.clientReferenceUrls,
            routes,
          };

          compilation.emitAsset(
            this.manifestFilename,
            new bundler.sources.RawSource(`${JSON.stringify(payload, null, 2)}\n`, false),
          );
        },
      );
    });
  }
}

module.exports = {
  ExperimentalRouteEntryRSCPlugin,
};

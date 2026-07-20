const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const webpack = require('webpack');
const {
  hasUseClientDirective,
  DEFAULT_CLIENT_REFERENCES_INCLUDE,
  DEFAULT_CLIENT_REFERENCES_EXCLUDE,
} = require('./clientReferences');

const PLUGIN_NAME = 'RSCModuleGraphPlugin';
const STYLE_MODULE_TYPES = new Set(['css/mini-extract', 'css', 'css/module', 'css/global', 'css/auto']);
const STYLE_SOURCE_RE = /\.(css|scss|sass|less|styl|pcss)$/i;
const SYNTHETIC_GENERATED_RESOURCE_RE =
  /(^|[/\\])app[/\\]javascript[/\\](?:packs[/\\]generated|generated)(?:[/\\]|$)/;

const ModuleDependency = webpack.dependencies.ModuleDependency;
const NullDependency = webpack.dependencies.NullDependency;
const Template = webpack.Template;

const clientFileNameOnClient = require.resolve('react-server-dom-webpack/client.browser');
const clientFileNameOnServer = require.resolve('react-server-dom-webpack/client.node');

class ClientReferenceDependency extends ModuleDependency {
  get type() {
    return 'client-reference';
  }
}

function isRuntimeResource(resource, isServer) {
  if (typeof resource !== 'string') return false;
  if (resource === (isServer ? clientFileNameOnServer : clientFileNameOnClient)) return true;

  const normalized = path.normalize(resource);
  const expectedSuffix = path.join(
    'react-server-dom-webpack',
    isServer ? 'client.node.js' : 'client.browser.js',
  );
  if (!normalized.endsWith(path.sep + expectedSuffix)) return false;

  let currentDir = path.dirname(normalized);
  for (let index = 0; index < 20; index += 1) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name === 'react-server-dom-webpack') return true;
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;
      if (!(error instanceof SyntaxError) && code !== 'ENOENT' && code !== 'ENOTDIR') {
        return false;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return false;
    currentDir = parentDir;
  }

  return false;
}

function normalizeClientReferences(clientReferences) {
  if (clientReferences) {
    return Array.isArray(clientReferences) ? clientReferences : [clientReferences];
  }

  return [
    {
      directory: '.',
      recursive: true,
      include: DEFAULT_CLIENT_REFERENCES_INCLUDE,
      exclude: DEFAULT_CLIENT_REFERENCES_EXCLUDE,
    },
  ];
}

function normalizeChunkName(chunkName) {
  const name = typeof chunkName === 'string' ? chunkName : 'client[index]';
  return /\[(index|request)\]/.test(name) ? name : `${name}[index]`;
}

function normalizeCssPrefix(publicPath) {
  if (typeof publicPath !== 'string' || publicPath === 'auto') return null;
  return publicPath.endsWith('/') ? publicPath : `${publicPath}/`;
}

function getCrossOriginValue(crossOriginLoading) {
  if (typeof crossOriginLoading !== 'string') return null;
  return crossOriginLoading === 'use-credentials' ? crossOriginLoading : 'anonymous';
}

function getSourceSize(source) {
  if (!source) return null;
  if (typeof source.size === 'function') {
    const size = source.size();
    return Number.isFinite(size) ? size : null;
  }
  if (typeof source.source === 'function') {
    const value = source.source();
    return typeof value === 'string' ? Buffer.byteLength(value) : value.length;
  }
  return null;
}

function getAssetSize(compilation, file, publicPath) {
  const candidates = new Set([file]);
  if (file.startsWith('/')) candidates.add(file.slice(1));
  if (publicPath && publicPath !== 'auto' && file.startsWith(publicPath)) {
    const stripped = file.slice(publicPath.length);
    candidates.add(stripped);
    if (stripped.startsWith('/')) candidates.add(stripped.slice(1));
  }

  for (const candidate of candidates) {
    const asset = compilation.getAsset?.(candidate)?.source ?? compilation.assets?.[candidate];
    const size = getSourceSize(asset);
    if (size !== null) return size;
  }

  return null;
}

function sumUniqueKnownBytes(references) {
  const seen = new Set();
  let total = 0;
  for (const reference of references) {
    for (const chunk of [...reference.chunks, ...(reference.css || [])]) {
      if (chunk.bytes === null || seen.has(chunk.file)) continue;
      seen.add(chunk.file);
      total += chunk.bytes;
    }
  }
  return total;
}

class RSCModuleGraphPlugin {
  constructor(options) {
    if (!options || typeof options.isServer !== 'boolean') {
      throw new Error(`${PLUGIN_NAME}: You must specify isServer as a boolean.`);
    }

    this.isServer = options.isServer;
    this.clientReferences = normalizeClientReferences(options.clientReferences);
    this.chunkName = normalizeChunkName(options.chunkName);
    this.clientManifestFilename =
      options.clientManifestFilename ||
      (this.isServer ? 'react-server-client-manifest.json' : 'react-client-manifest.json');
    this.clientReferenceDiagnosticsFilename = options.clientReferenceDiagnosticsFilename;
  }

  apply(compiler) {
    let resolvedClientReferences = [];
    let clientRuntimeFound = false;

    compiler.hooks.beforeCompile.tapAsync(PLUGIN_NAME, (_params, callback) => {
      try {
        resolvedClientReferences = this.resolveAllClientFiles(compiler.context);
        callback();
      } catch (error) {
        callback(error);
      }
    });

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation, params) => {
      const normalModuleFactory = params.normalModuleFactory;
      compilation.dependencyFactories.set(ClientReferenceDependency, normalModuleFactory);
      compilation.dependencyTemplates.set(ClientReferenceDependency, new NullDependency.Template());

      const handler = (parser) => {
        parser.hooks.program.tap(PLUGIN_NAME, () => {
          const module = parser.state.module;
          if (!isRuntimeResource(module.resource, this.isServer)) return;

          clientRuntimeFound = true;
          if (module.buildInfo) module.buildInfo.cacheable = false;

          for (let index = 0; index < resolvedClientReferences.length; index += 1) {
            const dependency = resolvedClientReferences[index];
            const chunkName = this.chunkName
              .replace(/\[index\]/g, String(index))
              .replace(/\[request\]/g, Template.toPath(dependency.userRequest));
            const block = new webpack.AsyncDependenciesBlock(
              { name: chunkName },
              undefined,
              dependency.request,
            );
            block.addDependency(dependency);
            module.addBlock(block);
          }
        });
      };

      normalModuleFactory.hooks.parser.for('javascript/auto').tap(PLUGIN_NAME, handler);
      normalModuleFactory.hooks.parser.for('javascript/esm').tap(PLUGIN_NAME, handler);
      normalModuleFactory.hooks.parser.for('javascript/dynamic').tap(PLUGIN_NAME, handler);
    });

    compiler.hooks.make.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          if (!clientRuntimeFound) {
            compilation.warnings.push(
              new webpack.WebpackError(`${PLUGIN_NAME}: Client runtime not found. Manifest not emitted.`),
            );
            return;
          }

          const resolvedClientFiles = new Set(resolvedClientReferences.map((ref) => ref.request));
          const runtimeChunkFiles = this.collectRuntimeChunkFiles(compilation);
          const cssPrefix = normalizeCssPrefix(compilation.outputOptions.publicPath);
          const filePathToModuleMetadata = {};
          const serverComponentCss = {};

          const moduleGraph = compilation.moduleGraph;
          const chunkGraph = compilation.chunkGraph;
          const getModuleChunksIterable = chunkGraph.getModuleChunksIterable?.bind(chunkGraph);

          const resourceToModule = new Map();
          const innerToOuter = new Map();

          for (const chunkGroup of compilation.chunkGroups) {
            for (const chunk of chunkGroup.chunks) {
              for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
                if (module.resource) resourceToModule.set(module.resource, module);
                if (module.modules) {
                  for (const innerModule of module.modules) {
                    if (innerModule.resource) {
                      resourceToModule.set(innerModule.resource, innerModule);
                      innerToOuter.set(innerModule, module);
                    }
                  }
                }
              }
            }
          }

          const resolveEffectiveModule = (module) => innerToOuter.get(module) || module;
          const clientFileChunkGroups = this.buildClientFileChunkGroups(
            compilation.chunkGroups,
            resolvedClientFiles,
          );

          for (const clientFile of resolvedClientFiles) {
            const module = resourceToModule.get(clientFile);
            if (!module || !module.resource) continue;

            const effectiveModule = resolveEffectiveModule(module);
            const href = pathToFileURL(module.resource).href;
            const chunks = this.collectClientChunks({
              clientFile,
              effectiveModule,
              clientFileChunkGroups,
              getModuleChunksIterable,
              runtimeChunkFiles,
            });
            const css = this.collectCssForModule({
              module: effectiveModule,
              moduleGraph,
              chunkGraph,
              cssPrefix,
              clientFiles: resolvedClientFiles,
            });

            filePathToModuleMetadata[href] = {
              id: chunkGraph.getModuleId(effectiveModule),
              chunks,
              css: css.length > 0 ? css : null,
              name: '*',
            };
          }

          if (moduleGraph) {
            for (const [resource, module] of resourceToModule) {
              if (resolvedClientFiles.has(resource)) continue;
              if (!/\.[cm]?[jt]sx?$/.test(resource)) continue;
              if (SYNTHETIC_GENERATED_RESOURCE_RE.test(resource)) continue;

              const css = this.collectCssForModule({
                module,
                moduleGraph,
                chunkGraph,
                cssPrefix,
                clientFiles: resolvedClientFiles,
                stopAtClientBoundaries: true,
              });
              if (css.length === 0) continue;

              serverComponentCss[pathToFileURL(resource).href] = css;
            }
          }

          const manifest = {
            moduleLoading: {
              prefix: compilation.outputOptions.publicPath || '',
              crossOrigin: getCrossOriginValue(compilation.outputOptions.crossOriginLoading),
            },
            filePathToModuleMetadata,
          };

          if (Object.keys(serverComponentCss).length > 0) {
            manifest.serverComponentCss = serverComponentCss;
          }

          if (typeof this.clientReferenceDiagnosticsFilename === 'string') {
            const diagnostics = this.buildDiagnostics(
              compilation,
              filePathToModuleMetadata,
              compilation.outputOptions.publicPath || '',
            );
            compilation.emitAsset(
              this.clientReferenceDiagnosticsFilename,
              new webpack.sources.RawSource(`${JSON.stringify(diagnostics, null, 2)}\n`, false),
            );
          }

          compilation.emitAsset(
            this.clientManifestFilename,
            new webpack.sources.RawSource(JSON.stringify(manifest, null, 2), false),
          );
        },
      );
    });
  }

  collectRuntimeChunkFiles(compilation) {
    const runtimeChunkFiles = new Set();
    compilation.entrypoints.forEach((entrypoint) => {
      const runtimeChunk = entrypoint.getRuntimeChunk();
      if (!runtimeChunk) return;
      for (const file of runtimeChunk.files) runtimeChunkFiles.add(file);
    });
    return runtimeChunkFiles;
  }

  buildClientFileChunkGroups(chunkGroups, resolvedClientFiles) {
    const clientFileChunkGroups = new Map();

    for (const chunkGroup of chunkGroups) {
      const blocks =
        typeof chunkGroup.getBlocks === 'function' ? chunkGroup.getBlocks() : chunkGroup.blocksIterable;
      if (!blocks) continue;

      for (const block of blocks) {
        if (!block?.dependencies) continue;
        for (const dependency of block.dependencies) {
          if (
            (dependency instanceof ClientReferenceDependency || dependency.type === 'client-reference') &&
            typeof dependency.request === 'string' &&
            resolvedClientFiles.has(dependency.request)
          ) {
            const groups = clientFileChunkGroups.get(dependency.request);
            if (groups) groups.push(chunkGroup);
            else clientFileChunkGroups.set(dependency.request, [chunkGroup]);
          }
        }
      }
    }

    return clientFileChunkGroups;
  }

  collectClientChunks({
    clientFile,
    effectiveModule,
    clientFileChunkGroups,
    getModuleChunksIterable,
    runtimeChunkFiles,
  }) {
    const chunks = [];
    const recordedChunkIds = new Set();

    const recordChunk = (chunk) => {
      if (recordedChunkIds.has(chunk.id)) return;
      for (const file of chunk.files) {
        if (
          (file.endsWith('.js') || file.endsWith('.mjs')) &&
          !file.endsWith('.hot-update.js') &&
          !file.endsWith('.hot-update.mjs') &&
          (this.isServer || !runtimeChunkFiles.has(file))
        ) {
          chunks.push(chunk.id, file);
          recordedChunkIds.add(chunk.id);
          break;
        }
      }
    };

    const groups = clientFileChunkGroups.get(clientFile);
    if (groups) {
      for (const group of groups) {
        for (const chunk of group.chunks) recordChunk(chunk);
      }
    }

    if (chunks.length === 0 && getModuleChunksIterable) {
      for (const chunk of getModuleChunksIterable(effectiveModule)) recordChunk(chunk);
    }

    return chunks;
  }

  collectCssForModule({
    module,
    moduleGraph,
    chunkGraph,
    cssPrefix,
    clientFiles,
    stopAtClientBoundaries = false,
  }) {
    if (!moduleGraph || cssPrefix === null) return [];

    const cssFiles = [];
    const visited = new Set();
    const getModuleChunksIterable = chunkGraph.getModuleChunksIterable?.bind(chunkGraph);

    const walk = (currentModule) => {
      if (!currentModule || visited.has(currentModule)) return;
      visited.add(currentModule);

      if (
        stopAtClientBoundaries &&
        currentModule !== module &&
        currentModule.resource &&
        clientFiles.has(currentModule.resource)
      ) {
        return;
      }

      const isNativeCss = currentModule.type && STYLE_MODULE_TYPES.has(currentModule.type);
      const isResourceCss = !isNativeCss && this.isCssModule(currentModule);

      if (isNativeCss || isResourceCss) {
        if (getModuleChunksIterable) {
          for (const chunk of getModuleChunksIterable(currentModule)) {
            for (const file of chunk.files) {
              if (!file.endsWith('.css') || file.endsWith('.hot-update.css')) continue;
              const href = `${cssPrefix}${file}`;
              if (!cssFiles.includes(href)) cssFiles.push(href);
            }
          }
        }
        if (isNativeCss) return;
      }

      for (const connection of moduleGraph.getOutgoingConnections(currentModule)) {
        const dependencyModule = connection.module || connection.resolvedModule;
        if (dependencyModule) walk(dependencyModule);
      }
    };

    walk(module);
    return cssFiles;
  }

  isCssModule(module) {
    if (module.type && STYLE_MODULE_TYPES.has(module.type)) return true;
    if (!module.resource) return false;
    return STYLE_SOURCE_RE.test(module.resource.replace(/[?#].*$/, ''));
  }

  resolveAllClientFiles(context) {
    const resolved = [];
    const seen = new Set();

    const addFile = (absoluteFilePath, userRequest = absoluteFilePath) => {
      if (seen.has(absoluteFilePath)) return;
      const content = fs.readFileSync(absoluteFilePath, 'utf8');
      if (!hasUseClientDirective(content)) return;

      const dependency = new ClientReferenceDependency(absoluteFilePath);
      dependency.userRequest = userRequest;
      seen.add(absoluteFilePath);
      resolved.push(dependency);
    };

    const walkDirectory = (rootDirectory, directory, options) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        const relativePath = `./${path.relative(rootDirectory, fullPath).replace(/\\/g, '/')}`;

        if (entry.isDirectory()) {
          if (options.exclude && options.exclude.test(relativePath)) continue;
          if (options.recursive !== false) walkDirectory(rootDirectory, fullPath, options);
          continue;
        }

        if (!entry.isFile()) continue;
        if (!options.include.test(relativePath)) continue;
        if (options.exclude && options.exclude.test(relativePath)) continue;
        addFile(fullPath, relativePath);
      }
    };

    for (const clientReferencePath of this.clientReferences) {
      if (typeof clientReferencePath === 'string') {
        addFile(path.resolve(context, clientReferencePath), clientReferencePath);
        continue;
      }

      const directory = path.resolve(context, clientReferencePath.directory);
      if (!fs.existsSync(directory)) continue;
      walkDirectory(directory, directory, clientReferencePath);
    }

    return resolved;
  }

  buildDiagnostics(compilation, filePathToModuleMetadata, publicPath) {
    const clientReferences = Object.entries(filePathToModuleMetadata)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([file, metadata]) => {
        const chunks = [];
        for (let index = 0; index < metadata.chunks.length; index += 2) {
          const chunkFile = String(metadata.chunks[index + 1]);
          chunks.push({
            id: metadata.chunks[index] ?? null,
            file: chunkFile,
            bytes: getAssetSize(compilation, chunkFile, publicPath),
          });
        }

        const css = metadata.css?.length
          ? metadata.css.map((fileName) => ({
              file: fileName,
              bytes: getAssetSize(compilation, fileName, publicPath),
            }))
          : undefined;

        const totalBytes = [...chunks, ...(css || [])].reduce(
          (sum, entry) => sum + (entry.bytes ?? 0),
          0,
        );

        return {
          file,
          id: metadata.id,
          name: metadata.name,
          totalBytes,
          chunks,
          ...(css ? { css } : {}),
        };
      });

    return {
      version: 1,
      manifestFilename: this.clientManifestFilename,
      isServer: this.isServer,
      clientReferenceCount: clientReferences.length,
      totalChunkBytes: sumUniqueKnownBytes(clientReferences),
      clientReferences,
      discoveryMethod: 'module-graph',
    };
  }
}

module.exports = {
  RSCModuleGraphPlugin,
  default: RSCModuleGraphPlugin,
};

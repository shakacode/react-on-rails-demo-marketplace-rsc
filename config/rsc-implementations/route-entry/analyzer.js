const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.styl'];
const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  '.bundle',
  '.claude',
  '.git',
  '.node-renderer-bundles',
  '.swc',
  '.yalc',
  'coverage',
  'log',
  'node_modules',
  'public',
  'ssr-generated',
  'storage',
  'tmp',
  'vendor',
]);

function normalizePath(file) {
  return file.replace(/\\/g, '/');
}

function shortHash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function stripExtension(file) {
  const ext = path.extname(file);
  return ext ? file.slice(0, -ext.length) : file;
}

function sanitizeName(value) {
  return normalizePath(value)
    .replace(/^[./]+/, '')
    .replace(/[^a-zA-Z0-9_/-]+/g, '-')
    .replace(/[/-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'route';
}

function isSourceFile(file) {
  return SOURCE_EXTENSIONS.includes(path.extname(file)) && !file.endsWith('.d.ts');
}

function isStyleFile(file) {
  const clean = file.replace(/[?#].*$/, '');
  return STYLE_EXTENSIONS.includes(path.extname(clean));
}

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function hasUseClientDirective(source) {
  let text = source.replace(/^\uFEFF/, '');
  if (text.startsWith('#!')) {
    const newline = text.indexOf('\n');
    text = newline === -1 ? '' : text.slice(newline + 1);
  }

  while (true) {
    const trimmed = text.trimStart();
    if (trimmed.startsWith('//')) {
      const newline = trimmed.indexOf('\n');
      if (newline === -1) return false;
      text = trimmed.slice(newline + 1);
      continue;
    }
    if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/');
      if (end === -1) return false;
      text = trimmed.slice(end + 2);
      continue;
    }
    text = trimmed;
    break;
  }

  return /^(['"])use client\1\s*(?:;|[\r\n]|$)/.test(text);
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const staticImportPattern =
    /(?:^|[\n;])\s*(?:import\s+(?!type\b)(?:(?:[\s\S]*?)\s+from\s+)?|export\s+(?:(?:[\s\S]*?)\s+from\s+|\*\s+from\s+))['"]([^'"]+)['"]/g;
  const sideEffectImportPattern = /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [staticImportPattern, sideEffectImportPattern, dynamicImportPattern]) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return specifiers;
}

function candidateFiles(base) {
  const candidates = [base];
  for (const ext of [...SOURCE_EXTENSIONS, ...STYLE_EXTENSIONS]) {
    candidates.push(base + ext);
  }
  for (const ext of SOURCE_EXTENSIONS) {
    candidates.push(path.join(base, 'index' + ext));
  }
  return candidates;
}

function resolveImport(fromFile, specifier) {
  if (!specifier || specifier.startsWith('node:')) return null;
  if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) return null;

  const cleanSpecifier = specifier.replace(/[?#].*$/, '');
  const base = path.isAbsolute(cleanSpecifier)
    ? cleanSpecifier
    : path.resolve(path.dirname(fromFile), cleanSpecifier);

  for (const candidate of candidateFiles(base)) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function walkDirectories(root, visitor) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.storybook') continue;
    if (entry.isDirectory() && DEFAULT_EXCLUDED_DIRECTORIES.has(entry.name)) continue;

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      visitor(fullPath, entry);
      walkDirectories(fullPath, visitor);
    }
  }
}

function findNamedDirectories(searchRoots, directoryName) {
  const matches = [];
  for (const root of searchRoots) {
    walkDirectories(root, (directory) => {
      if (path.basename(directory) === directoryName) {
        matches.push(directory);
      }
    });

    if (path.basename(root) === directoryName) {
      matches.push(root);
    }
  }

  return [...new Set(matches)].sort();
}

function collectRouteFiles(routeDirectories) {
  const files = [];
  for (const directory of routeDirectories) {
    const visit = (current) => {
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
        } else if (entry.isFile() && isSourceFile(fullPath)) {
          files.push({ routeDirectory: directory, file: fullPath });
        }
      }
    };

    visit(directory);
  }

  return files.sort((left, right) => left.file.localeCompare(right.file));
}

function addOrdered(target, seen, value) {
  if (seen.has(value)) return;
  seen.add(value);
  target.push(value);
}

function analyzeRoute(rootFile, routeName) {
  const serverModules = [];
  const serverCssFiles = [];
  const clientReferenceFiles = [];
  const seenServerModules = new Set();
  const seenServerCss = new Set();
  const seenClientReferences = new Set();

  const walkModule = (file) => {
    if (seenServerModules.has(file)) return;
    const source = readFile(file);
    if (source == null) return;

    if (hasUseClientDirective(source)) {
      addOrdered(clientReferenceFiles, seenClientReferences, file);
      return;
    }

    seenServerModules.add(file);
    serverModules.push(file);

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveImport(file, specifier);
      if (!resolved) continue;

      if (isStyleFile(resolved)) {
        addOrdered(serverCssFiles, seenServerCss, resolved);
      } else if (isSourceFile(resolved)) {
        walkModule(resolved);
      }
    }
  };

  walkModule(rootFile);

  return {
    name: routeName,
    rootFile,
    root: url.pathToFileURL(rootFile).href,
    serverModuleCount: serverModules.length,
    serverModules: serverModules.map((file) => url.pathToFileURL(file).href),
    serverCssFiles,
    serverCss: serverCssFiles.map((file) => url.pathToFileURL(file).href),
    clientReferenceFiles,
    clientRefs: clientReferenceFiles.map((file) => url.pathToFileURL(file).href),
  };
}

function analyzeRouteEntries(options) {
  const projectRoot = options.projectRoot;
  const routeEntryDirectoryName = options.routeEntryDirectoryName || 'startup';
  const searchRoots = (options.searchRoots && options.searchRoots.length
    ? options.searchRoots
    : [path.join(projectRoot, 'app', 'javascript')]
  ).map((root) => path.resolve(projectRoot, root));
  const generatedEntryDirectory = path.resolve(
    projectRoot,
    options.generatedEntryDirectory || 'tmp/rsc-route-entry-experiment',
  );
  const routeDirectories = findNamedDirectories(searchRoots, routeEntryDirectoryName);
  const routeFiles = collectRouteFiles(routeDirectories);

  const routes = {};
  const allClientReferenceFiles = [];
  const seenClientReferenceFiles = new Set();

  for (const { routeDirectory, file } of routeFiles) {
    const relativeRoute = stripExtension(path.relative(routeDirectory, file));
    const projectRelative = stripExtension(path.relative(projectRoot, file));
    const routeName = sanitizeName(relativeRoute);
    const uniqueRouteName = routes[routeName]
      ? `${routeName}-${shortHash(projectRelative)}`
      : routeName;
    const route = analyzeRoute(file, uniqueRouteName);
    const entryBase = `rsc-route-${sanitizeName(uniqueRouteName)}-${shortHash(file)}`;

    route.routeDirectory = routeDirectory;
    route.generatedEntryName = entryBase;
    route.generatedEntryFile = path.join(generatedEntryDirectory, `${entryBase}.js`);
    route.projectRelativeRoot = normalizePath(path.relative(projectRoot, file));
    routes[uniqueRouteName] = route;

    for (const clientReferenceFile of route.clientReferenceFiles) {
      addOrdered(allClientReferenceFiles, seenClientReferenceFiles, clientReferenceFile);
    }
  }

  return {
    version: 1,
    implementation: 'route_entry',
    routeEntryDirectoryName,
    searchRoots: searchRoots.map((root) => normalizePath(path.relative(projectRoot, root))),
    generatedEntryDirectory,
    routeCount: Object.keys(routes).length,
    clientReferenceCount: allClientReferenceFiles.length,
    clientReferences: allClientReferenceFiles,
    clientReferenceUrls: allClientReferenceFiles.map((file) => url.pathToFileURL(file).href),
    routes,
  };
}

function writeGeneratedRouteEntries(analysis) {
  fs.rmSync(analysis.generatedEntryDirectory, { recursive: true, force: true });
  fs.mkdirSync(analysis.generatedEntryDirectory, { recursive: true });

  for (const route of Object.values(analysis.routes)) {
    const imports = [];
    imports.push('// Generated by config/rsc-implementations/route-entry.');
    imports.push(`// Route: ${route.name}`);

    for (const cssFile of route.serverCssFiles) {
      imports.push(`import ${JSON.stringify(cssFile)};`);
    }

    route.clientReferenceFiles.forEach((clientReferenceFile, index) => {
      imports.push(`import * as clientReference${index} from ${JSON.stringify(clientReferenceFile)};`);
      imports.push(`void clientReference${index};`);
    });

    if (route.serverCssFiles.length === 0 && route.clientReferenceFiles.length === 0) {
      imports.push('export {};');
    }

    fs.writeFileSync(route.generatedEntryFile, `${imports.join('\n')}\n`);
  }
}

module.exports = {
  analyzeRouteEntries,
  writeGeneratedRouteEntries,
};

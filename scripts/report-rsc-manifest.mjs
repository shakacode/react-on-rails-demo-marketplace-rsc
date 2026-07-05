#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve(process.env.MANIFEST_PATH || 'public/packs/react-client-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const projectRoot = process.cwd();
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const GENERATED_PACK_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

const moduleEntries = Object.entries(manifest.filePathToModuleMetadata || {});
const chunkFiles = new Set();
const cssFiles = new Set();
let chunkRefs = 0;
let cssRefs = 0;

for (const [, metadata] of moduleEntries) {
  const chunks = Array.isArray(metadata.chunks) ? metadata.chunks : [];
  for (let index = 1; index < chunks.length; index += 2) {
    chunkRefs += 1;
    chunkFiles.add(String(chunks[index]));
  }

  for (const href of metadata.css || []) {
    cssRefs += 1;
    cssFiles.add(href);
  }
}

const serverComponentCss = manifest.serverComponentCss || {};

function fileUrlFor(absolutePath) {
  return `file://${absolutePath}`;
}

function findExistingComponentFile(basePath, extensions) {
  for (const extension of extensions) {
    const candidate = resolve(`${basePath}${extension}`);
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch (_error) {
      // keep looking
    }
  }

  return null;
}

function resolveSimpleReexportTarget(componentName) {
  const startupBase = resolve(projectRoot, 'app/javascript/startup', componentName);
  const startupFile = findExistingComponentFile(startupBase, SOURCE_EXTENSIONS);
  if (!startupFile) return null;

  const source = readFileSync(startupFile, 'utf8');
  const match = source.match(/^\s*export\s+\{\s*default\s*\}\s+from\s+["']([^"']+)["']/m);
  if (!match || !match[1].startsWith('.')) return null;

  const targetBase = resolve(dirname(startupFile), match[1]);
  return findExistingComponentFile(targetBase, SOURCE_EXTENSIONS);
}

function resolveServerComponentManifestEntry(componentName) {
  const manifestKeys = [];
  const targetFile = resolveSimpleReexportTarget(componentName);
  if (targetFile) manifestKeys.push(fileUrlFor(targetFile));

  const startupBase = resolve(projectRoot, 'app/javascript/startup', componentName);
  const startupFile = findExistingComponentFile(startupBase, SOURCE_EXTENSIONS);
  if (startupFile) manifestKeys.push(fileUrlFor(startupFile));

  const generatedBase = resolve(projectRoot, 'app/javascript/packs/generated', componentName);
  for (const extension of GENERATED_PACK_EXTENSIONS) {
    const generatedFile = resolve(`${generatedBase}${extension}`);
    try {
      readFileSync(generatedFile, 'utf8');
      manifestKeys.push(fileUrlFor(generatedFile));
      break;
    } catch (_error) {
      // keep looking
    }
  }

  const manifestKey = manifestKeys.find((candidate) => Object.hasOwn(serverComponentCss, candidate));
  if (!manifestKey) return null;

  return {
    component: componentName,
    manifestKey,
    css: serverComponentCss[manifestKey],
  };
}

const cssDemoServerEntries = ['CssPageOneServerCss', 'CssPageTwoServerCss']
  .map(resolveServerComponentManifestEntry)
  .filter(Boolean);

console.log(JSON.stringify({
  manifestPath,
  clientReferenceCount: moduleEntries.length,
  jsChunkReferenceCount: chunkRefs,
  cssReferenceCount: cssRefs,
  uniqueJsChunkFiles: [...chunkFiles].sort(),
  uniqueCssFiles: [...cssFiles].sort(),
  serverComponentCssEntryCount: Object.keys(serverComponentCss).length,
  cssDemoServerEntries,
}, null, 2));

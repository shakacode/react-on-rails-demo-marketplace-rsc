#!/usr/bin/env node
/**
 * Static check: any source file marked `'use client'` (i.e., shipped to browser)
 * must not statically import a heavy server-only library. Catches RSC "chunk
 * contamination" at the source level — before webpack runs.
 *
 * Heavy libraries are intentionally kept server-only so the RSC variants of
 * pages render markdown/charts/sanitization on the server and ship only HTML.
 * If a `'use client'` file imports any of these, that library ends up in the
 * client bundle and the RSC perf advantage disappears.
 *
 * Run: `node scripts/check-rsc-imports.mjs` (also wired as `pnpm lint:rsc`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const JS_ROOT = join(ROOT, 'app/javascript');

const BANNED_FROM_USE_CLIENT = [
  'marked',
  'marked-highlight',
  'highlight.js',
  'sanitize-html',
  'gray-matter',
  'intl-messageformat',
  'simple-statistics',
  // d3-* charting libs are heavy; RSC pre-renders SVG so client never needs them
  'd3-scale',
  'd3-shape',
  'd3-array',
  'd3-format',
  'd3-time',
  'd3-time-format',
  'd3-interpolate',
  'd3-color',
  'd3-path',
  'date-fns-tz',
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === 'generated' || entry === 'packs') continue;
      yield* walk(full);
    } else if (/\.(t|j)sx?$/.test(entry)) {
      yield full;
    }
  }
}

function stripCommentsAtStart(src) {
  // Strip leading whitespace, line comments, and block comments to find the
  // first real statement. We do not need a full parser — just enough to find
  // the directive.
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.slice(i, i + 2) === '//') {
      i = src.indexOf('\n', i);
      if (i < 0) return '';
      continue;
    }
    if (src.slice(i, i + 2) === '/*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) return '';
      i = end + 2;
      continue;
    }
    break;
  }
  return src.slice(i);
}

function hasUseClient(src) {
  const trimmed = stripCommentsAtStart(src);
  return /^['"]use client['"]\s*;?/.test(trimmed);
}

function findImports(src) {
  // Match static `import ... from '<spec>'` and `import '<spec>'`. Ignores
  // dynamic imports — those are by design lazy-loaded.
  const out = [];
  const re = /^\s*import(?:\s+[\s\S]*?\s+from)?\s*['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

function isBanned(spec) {
  return BANNED_FROM_USE_CLIENT.some(
    (pkg) => spec === pkg || spec.startsWith(`${pkg}/`),
  );
}

let violations = 0;
for (const file of walk(JS_ROOT)) {
  const src = readFileSync(file, 'utf8');
  if (!hasUseClient(src)) continue;
  const imports = findImports(src);
  const bad = imports.filter(isBanned);
  if (bad.length > 0) {
    violations += bad.length;
    const rel = relative(ROOT, file);
    console.error(`✗ ${rel}`);
    for (const b of bad) console.error(`    imports banned heavy lib: ${b}`);
  }
}

if (violations > 0) {
  console.error(
    `\n${violations} chunk-contamination violation(s) found. ` +
      `'use client' files cannot statically import server-only heavy libs ` +
      `— move that code into a non-'use client' module rendered from the RSC tree.`,
  );
  process.exit(1);
}

console.log('✓ no chunk-contamination from heavy-lib imports detected');

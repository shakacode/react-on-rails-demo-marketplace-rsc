#!/usr/bin/env node
/**
 * Post-build chunk-contamination check.
 *
 * Heavy server-only libraries (marked, highlight.js, sanitize-html, d3, etc.)
 * are bundled into their own webpack split chunks (markdown-libs, charting-libs).
 * Those chunks are PERMITTED to exist — the SSR/client variants intentionally
 * load them client-side as the comparison baseline against RSC.
 *
 * What we want to catch is the contamination case: an RSC entry pack
 * (`generated/<Name>RSC-*.js`) — or its initial-chunk dependency tree —
 * pulling those chunks in. That would mean a 'use client' file inside the RSC
 * tree's import graph leaked the heavy lib into the client.
 *
 * Strategy:
 *   1. From `runtime-*.js` parse the chunk-ID → filename map.
 *   2. For each `generated/<Name>RSC-*.js` entry pack:
 *        - extract the chunk IDs it depends on (from its push payload)
 *        - mark any heavy-lib chunk reachable from that entry as a violation.
 *
 * Counterpart to scripts/check-rsc-imports.mjs which catches problems at the
 * source level. This one catches the post-bundle reality.
 *
 * Run:  `node scripts/check-rsc-chunks.mjs`  (also `pnpm verify:rsc`)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const PACKS_JS = join(ROOT, 'public/packs/js');

// Fingerprint patterns: if any chunk's source contains one of these regexes,
// we treat that chunk as "carries heavy lib X". Keep these idiosyncratic
// enough that minified output keeps them.
const HEAVY_LIB_FINGERPRINTS = [
  { lib: 'marked',             sig: /this\.tokens\.links\s*=/ },
  { lib: 'highlight.js',       sig: /registerLanguage|hljs\.highlight\(/ },
  { lib: 'sanitize-html',      sig: /allowedSchemesByTag|nonBooleanAttributes/ },
  { lib: 'intl-messageformat', sig: /TYPE\.literal|MessageFormat#format/ },
  { lib: 'simple-statistics',  sig: /sampleStandardDeviation|linearRegression/ },
  { lib: 'gray-matter',        sig: /matter\.test|matter\.read/ },
  // For d3, source-level identifiers don't survive minification. Match the
  // chunk-name we explicitly assigned in clientWebpackConfig.js's
  // splitChunks.cacheGroups (markdown-libs, charting-libs) instead.
  { lib: 'd3-charting-libs',   sig: /charting-libs/, byFilename: true },
  { lib: 'markdown-libs',      sig: /markdown-libs/, byFilename: true },
];

if (!statSync(PACKS_JS, { throwIfNoEntry: false })) {
  console.error(`✗ ${PACKS_JS} does not exist — run \`bin/shakapacker\` first`);
  process.exit(2);
}

// 1. Discover all `.js` chunk files; classify which carry heavy libs.
function* walkJs(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) yield* walkJs(full);
    else if (entry.endsWith('.js') && !entry.endsWith('.map.js')) yield full;
  }
}

const heavyChunkLibs = new Map(); // chunkFileBaseName -> [libs]
for (const file of walkJs(PACKS_JS)) {
  const name = basename(file);
  if (name === 'server-bundle.js' || name === 'rsc-bundle.js') continue;
  let src = null;
  const libs = [];
  for (const fp of HEAVY_LIB_FINGERPRINTS) {
    if (fp.byFilename) {
      if (fp.sig.test(name)) libs.push(fp.lib);
    } else {
      if (src === null) src = readFileSync(file, 'utf8');
      if (fp.sig.test(src)) libs.push(fp.lib);
    }
  }
  if (libs.length > 0) heavyChunkLibs.set(name, libs);
}

// 2. Parse runtime's chunk-ID → filename map. The runtime exposes it inline
//    via `r.u = e => 7329 === e ? "js/markdown-libs-...js" : ...` etc.
function loadChunkIdToFilename() {
  const runtimeFile = readdirSync(PACKS_JS).find((f) => /^runtime-.*\.js$/.test(f));
  if (!runtimeFile) throw new Error('cannot find runtime-*.js');
  const src = readFileSync(join(PACKS_JS, runtimeFile), 'utf8');
  const map = new Map();

  // Inline ternary chain: 7329===e?"js/markdown-libs-f83...js":6308===e?"js/...":...
  for (const m of src.matchAll(/(\d+)===e\?"([^"]+)"/g)) {
    map.set(Number(m[1]), m[2]);
  }
  // Object lookup form: {309:"client29", 314:"client44", ...} for chunk names,
  // and {309:"hash29", ...} for hashes. Combine with a fallback prefix "js/".
  // We only need the file paths so the inline form is enough for our cases.

  // Handle the table form: r.u = e => "js/" + ({...}[e] || e) + "-" + {hash}[e] + ".chunk.js"
  // Extract base map and hash map.
  const baseMap = {};
  const hashMap = {};
  const tablesRe = /\{(\s*\d+\s*:\s*"[^"]+"\s*,?)+\}/g;
  const tables = [...src.matchAll(tablesRe)].map((m) => m[0]);
  if (tables.length >= 2) {
    // First table: base names; second: hashes.
    for (const m of tables[0].matchAll(/(\d+)\s*:\s*"([^"]+)"/g)) {
      baseMap[m[1]] = m[2];
    }
    for (const m of tables[1].matchAll(/(\d+)\s*:\s*"([^"]+)"/g)) {
      hashMap[m[1]] = m[2];
    }
    for (const id of Object.keys(baseMap)) {
      if (hashMap[id] && !map.has(Number(id))) {
        map.set(Number(id), `js/${baseMap[id]}-${hashMap[id]}.chunk.js`);
      }
    }
  }
  return map;
}

const chunkIdToFile = loadChunkIdToFilename();

// 3. For each generated/<Name>RSC-*.js entry pack, extract its dep chunk IDs
//    and check if any reach a heavy-lib chunk.
const generatedDir = join(PACKS_JS, 'generated');
if (!statSync(generatedDir, { throwIfNoEntry: false })) {
  console.error('✗ public/packs/js/generated/ missing — auto_load_bundle did not run');
  process.exit(2);
}

const rscEntries = readdirSync(generatedDir).filter((f) => /RSC[^/]*-\w+\.js$/.test(f) && !f.endsWith('.map'));

// Patterns of webpack chunk-loading deps in entry packs. Both shapes:
//   __webpack_require__.O(0, [chunkIdA, chunkIdB], () => ...)
//   l.O(0, [chunkIdA, chunkIdB], ...)
function depChunkIdsFor(src) {
  const ids = new Set();
  // Look for `.O(0,[<numbers>]` or `.e(<number>)`
  for (const m of src.matchAll(/[lr]\.O\(0,\s*\[([\d,\s]+)\]/g)) {
    for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) ids.add(Number(n));
  }
  for (const m of src.matchAll(/[lr]\.e\((\d+)\)/g)) ids.add(Number(m[1]));
  return ids;
}

// Heavy-chunk set for fast lookup, by basename
const heavyByBase = new Map();
for (const [base, libs] of heavyChunkLibs) heavyByBase.set(base, libs);

const violations = [];
for (const entry of rscEntries) {
  const src = readFileSync(join(generatedDir, entry), 'utf8');
  const deps = depChunkIdsFor(src);
  for (const id of deps) {
    const file = chunkIdToFile.get(id);
    if (!file) continue;
    const base = basename(file);
    const libs = heavyByBase.get(base);
    if (libs && libs.length > 0) {
      violations.push({ entry, depFile: base, libs });
    }
  }
}

// 4. Report.
if (heavyChunkLibs.size > 0) {
  console.log('Heavy-lib chunks found in build (these are OK to exist — used by SSR/client variants):');
  for (const [name, libs] of heavyChunkLibs) {
    console.log(`  • ${name}  →  ${libs.join(', ')}`);
  }
  console.log();
}

if (violations.length > 0) {
  console.error(`✗ Found ${violations.length} chunk-contamination violation(s):`);
  for (const v of violations) {
    console.error(`    RSC entry  ${v.entry}`);
    console.error(`      pulls in ${v.depFile}  (carries: ${v.libs.join(', ')})`);
  }
  console.error(
    `\nAn RSC entry pack should never depend on a chunk carrying server-only ` +
      `libraries — that means a 'use client' module inside its tree is ` +
      `importing one. Refactor so the heavy lib is reached only from non-` +
      `'use client' files.`,
  );
  process.exit(1);
}

console.log(`✓ ${rscEntries.length} RSC entry pack(s) checked — no heavy-lib chunks reachable from any of them`);

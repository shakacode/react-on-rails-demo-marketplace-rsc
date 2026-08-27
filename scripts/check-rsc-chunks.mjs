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
 *   3. Flight client-reference audit (issue #184): the entry-pack check above
 *      cannot see client components loaded THROUGH THE RSC PAYLOAD — their
 *      chunk ids arrive in the flight stream via react-client-manifest.json,
 *      never in the entry's static list. So walk each RSC page's source tree
 *      (startup component without 'use client') to its 'use client'
 *      boundaries, look each boundary up in react-client-manifest.json, and
 *      flag any whose manifest chunk list contains a heavy-lib chunk. This is
 *      what catches a "Shape A" wrapper — and manifest chunk-group pollution,
 *      where a boundary module shared with a heavy client entry lists that
 *      entry's whole chunk group (the reason the *ForServer re-export
 *      convention exists). Static imports only, like check-rsc-imports.mjs.
 *
 * Counterpart to scripts/check-rsc-imports.mjs which catches problems at the
 * source level. This one catches the post-bundle reality.
 *
 * Run:  `node scripts/check-rsc-chunks.mjs`  (also `pnpm verify:rsc`)
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, dirname, resolve } from 'node:path';
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

// 4. Flight client-reference audit (see step 3 in the header).
const JS_APP_ROOT = join(ROOT, 'app/javascript');
const MANIFEST_PATH = join(ROOT, 'public/packs/react-client-manifest.json');

function stripCommentsAtStart(src) {
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i += 1;
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

const hasUseClient = (src) => /^['"]use client['"]\s*;?/.test(stripCommentsAtStart(src));

const SOURCE_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith('@/')) base = join(JS_APP_ROOT, spec.slice(2));
  else return null; // package import — not part of the app source graph
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of SOURCE_EXTS) if (existsSync(base + ext)) return base + ext;
  for (const ext of SOURCE_EXTS) {
    if (existsSync(join(base, `index${ext}`))) return join(base, `index${ext}`);
  }
  return null;
}

function findStaticImports(src) {
  const out = [];
  const re = /^\s*(?:import(?:\s+[\s\S]*?\s+from)?|export\s+(?:\*|\{[\s\S]*?\})\s+from)\s*['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

// RSC page roots: auto-bundled startup components without 'use client'.
const startupDir = join(JS_APP_ROOT, 'startup');
const rscRoots = readdirSync(startupDir)
  .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.client\.|\.server\./.test(f))
  .map((f) => join(startupDir, f))
  .filter((f) => !hasUseClient(readFileSync(f, 'utf8')));

function clientBoundariesFor(root) {
  const boundaries = new Set();
  const seen = new Set();
  const queue = [root];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    if (file !== root && hasUseClient(src)) {
      boundaries.add(file);
      continue; // everything past the boundary loads via the boundary's chunks
    }
    for (const spec of findStaticImports(src)) {
      const resolved = resolveImport(file, spec);
      if (resolved) queue.push(resolved);
    }
  }
  return boundaries;
}

const flightViolations = [];
if (existsSync(MANIFEST_PATH)) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).filePathToModuleMetadata ?? {};
  for (const root of rscRoots) {
    for (const boundary of clientBoundariesFor(root)) {
      const meta = manifest[`file://${boundary}`];
      const rootName = basename(root);
      const boundaryRel = relative(ROOT, boundary);
      if (!meta) {
        flightViolations.push({
          root: rootName,
          boundary: boundaryRel,
          reason: 'not present in react-client-manifest.json — stale build? rerun bin/shakapacker',
        });
        continue;
      }
      // meta.chunks alternates [id, "js/file.js", id, "js/file.js", ...]
      const chunkFiles = meta.chunks.filter((_, i) => i % 2 === 1);
      for (const file of chunkFiles) {
        const libs = heavyByBase.get(basename(file));
        if (libs && libs.length > 0) {
          flightViolations.push({ root: rootName, boundary: boundaryRel, depFile: basename(file), libs });
        }
      }
    }
  }
} else {
  console.error(`✗ ${MANIFEST_PATH} does not exist — run \`bin/shakapacker\` first`);
  process.exit(2);
}

// 5. Report.
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
}

if (flightViolations.length > 0) {
  console.error(`✗ Found ${flightViolations.length} flight client-reference violation(s):`);
  for (const v of flightViolations) {
    console.error(`    RSC page   ${v.root}`);
    if (v.reason) {
      console.error(`      boundary ${v.boundary} — ${v.reason}`);
    } else {
      console.error(`      boundary ${v.boundary}`);
      console.error(`      loads    ${v.depFile}  (carries: ${v.libs.join(', ')})`);
    }
  }
  console.error(
    `\nA 'use client' boundary referenced from an RSC page loads every chunk ` +
      `in its react-client-manifest.json entry at hydration. Either the ` +
      `boundary reaches a heavy lib (Shape A contamination) or it shares a ` +
      `chunk group with a heavy client entry — import the boundary through a ` +
      `dedicated *ForServer re-export so it gets its own clean chunk group.`,
  );
}

if (violations.length > 0 || flightViolations.length > 0) {
  process.exit(1);
}

console.log(`✓ ${rscEntries.length} RSC entry pack(s) checked — no heavy-lib chunks reachable from any of them`);
const boundaryTotal = rscRoots.reduce((sum, root) => sum + clientBoundariesFor(root).size, 0);
console.log(`✓ ${rscRoots.length} RSC page(s) audited via react-client-manifest.json — no heavy-lib chunks behind any of their ${boundaryTotal} client boundaries`);

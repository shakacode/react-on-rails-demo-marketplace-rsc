#!/usr/bin/env node
// Regression guard for the RSC server-component CSS fix (see docs/css-code-splitting-experiment.md).
//
// Asserts, against a running server, that each /css-demo/{one,two}/rsc-server page:
//   - links its own CSS in the <head> (render-blocking → no FOUC),
//   - downloads exactly its set: page one = cssShared + cssA, page two = cssShared + cssB,
//   - never downloads the OTHER page's CSS (no over-fetch / no unneeded CSS),
//   - downloads cssShared exactly once,
//   - ships no carrier-pack <script> (css_demo_one/two are stylesheet-only).
// Sentinels (content, not filenames) are the ground truth, since splitChunks renames chunks.
//
// Usage: BASE=http://localhost:5000 node scripts/verify-css-demo-server-css.mjs
const BASE = process.env.BASE || 'http://localhost:5000';

const PAGES = {
  one: { path: '/css-demo/one/rsc-server', want: ['SENTINEL_CSSSHARED', 'SENTINEL_CSSA'], forbid: 'SENTINEL_CSSB' },
  two: { path: '/css-demo/two/rsc-server', want: ['SENTINEL_CSSSHARED', 'SENTINEL_CSSB'], forbid: 'SENTINEL_CSSA' },
};

const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✓ ${msg}`);

const headOf = (html) => html.split('</head>')[0];
const styleHrefs = (html) =>
  [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const carrierScripts = (html) =>
  [...html.matchAll(/<script[^>]+src="([^"]*css_demo_(?:one|two)[^"]*)"/g)].map((m) => m[1]);

for (const [name, cfg] of Object.entries(PAGES)) {
  const html = await (await fetch(BASE + cfg.path)).text();
  const head = headOf(html);

  // every stylesheet link this page uses must be in the <head> (no late body-injected CSS)
  const allHrefs = styleHrefs(html);
  const headHrefs = styleHrefs(head);
  for (const href of allHrefs) {
    if (!headHrefs.includes(href)) fail(`${name}: stylesheet not in <head>: ${href}`);
  }

  // fetch served CSS and check sentinels
  let css = '';
  for (const href of [...new Set(allHrefs)]) css += await (await fetch(BASE + href)).text();
  const count = (s) => (css.match(new RegExp(s, 'g')) || []).length;

  for (const s of cfg.want) {
    if (count(s) < 1) fail(`${name}: missing required CSS ${s}`);
  }
  if (count('SENTINEL_CSSSHARED') !== 1) fail(`${name}: cssShared not downloaded exactly once (${count('SENTINEL_CSSSHARED')}x)`);
  if (count(cfg.forbid) !== 0) fail(`${name}: OVER-FETCH — downloaded ${cfg.forbid}`);

  const scripts = carrierScripts(html);
  if (scripts.length) fail(`${name}: carrier-pack script shipped: ${scripts.join(', ')}`);

  if (!process.exitCode) ok(`${name}/rsc-server: ${cfg.want.join(' + ')} in <head>, no ${cfg.forbid}, no carrier JS`);
}

if (process.exitCode) console.error('\nCSS-demo server-component CSS guard FAILED');
else console.log('\nAll CSS-demo server-component CSS checks passed');

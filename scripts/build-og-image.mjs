// Generates public/og-image.png — the 1200×630 social-share card referenced by
// the Open Graph / Twitter <meta> tags in app/views/layouts/application.html.erb.
//
// Rendered from an inline SVG so it stays in lock-step with the site's palette
// and messaging. Re-run after editing copy/colours:  node scripts/build-og-image.mjs
//
// Rasterises with rsvg-convert (preferred) and falls back to ImageMagick.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.5" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#172554"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.32" r="0.6">
      <stop offset="0" stop-color="#6366f1" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#818cf8"/>
      <stop offset="0.5" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#brand)"/>

  <g font-family="'Helvetica Neue', Helvetica, Arial, sans-serif">
    <text x="80" y="152" font-size="26" font-weight="700" letter-spacing="8" fill="#34d399">REACT ON RAILS PRO</text>

    <text x="80" y="272" font-size="70" font-weight="800" fill="#ffffff">React Server Components</text>
    <text x="80" y="360" font-size="70" font-weight="800" fill="url(#brand)">for Ruby on Rails</text>

    <text x="80" y="448" font-size="30" font-weight="500" fill="#cbd5e1">A live demo — RSC vs SSR vs client-side rendering</text>

    <text x="80" y="532" font-size="28" font-weight="700" fill="#818cf8">2× faster loads   ·   0 ms to interact   ·   24 Lighthouse audits</text>

    <text x="80" y="592" font-size="24" font-weight="600" fill="#64748b">rsc.reactonrails.com</text>
  </g>
</svg>
`;

const tmp = join(mkdtempSync(join(tmpdir(), 'og-')), 'og.svg');
writeFileSync(tmp, svg);

const renderers = [
  ['rsvg-convert', ['-w', '1200', '-h', '630', tmp, '-o', OUT]],
  ['magick', [tmp, '-resize', '1200x630', OUT]],
  ['convert', [tmp, '-resize', '1200x630', OUT]],
];

let rendered = false;
for (const [bin, args] of renderers) {
  try {
    execFileSync(bin, args, { stdio: 'pipe' });
    console.log(`Wrote ${OUT} via ${bin}`);
    rendered = true;
    break;
  } catch {
    // try the next renderer
  }
}

if (!rendered) {
  console.error('No SVG rasteriser found. Install librsvg (rsvg-convert) or ImageMagick.');
  process.exit(1);
}

# RSC Route Entry Size Comparison

This note compares the released `react-on-rails-rsc` build path with the local
`route-entry-experiment` adapter in this branch.

The comparison is intentionally scoped to the assets controlled by the RSC
plugin/loader behavior:

- Released mode uses `react-client-manifest.json` and counts the JS/CSS chunks
  for the client references discovered for each route.
- Experimental mode uses `react-rsc-route-entry-manifest.json` and counts the
  generated `rsc-route-*` entry files for each route.
- The common page shell is not counted: `application` CSS, `client-bundle`,
  HTML, images, API responses, and the Flight payload are shared costs outside
  this experiment.
- Webpack runtime is excluded from the experimental route-entry numbers because
  the released client-reference manifest also assumes the runtime is already on
  the page. If a page had to load the experimental runtime first, add 7.2 KiB
  raw / 3.6 KiB gzip once.
- Sizes are raw production asset bytes from `public/packs`. The `Gzip delta`
  column is a local gzip-9 estimate, included only to show likely transfer-size
  direction.
- This is a static production-build asset comparison, not a browser waterfall.
  The generated route entries are benchmark artifacts in this branch; the Rails
  views do not yet link them as the real page assets.

One important caveat: the CSS demo server pages currently use explicit Rails
view carrier packs (`css_demo_one` / `css_demo_two`) as a workaround for
server-component CSS. This table ignores that workaround so it can isolate what
the released plugin reports versus what the experimental route-entry build can
discover.

## Build Inputs

Measured on July 4, 2026 from this branch using webpack production builds:

```bash
rm -rf public/packs ssr-generated tmp/rsc-route-entry-experiment tmp/rsc-size-comparison
mkdir -p tmp/rsc-size-comparison/released-webpack
NODE_ENV=production \
  pnpm exec webpack --config config/webpack/webpack.config.js
cp -R public/packs tmp/rsc-size-comparison/released-webpack/public-packs
cp -R ssr-generated tmp/rsc-size-comparison/released-webpack/ssr-generated

mkdir -p tmp/rsc-size-comparison/route-entry-webpack
rm -rf public/packs ssr-generated tmp/rsc-route-entry-experiment
RSC_BUILD_ADAPTER=route-entry-experiment NODE_ENV=production \
  pnpm exec webpack --config config/webpack/webpack.config.js
cp -R public/packs tmp/rsc-size-comparison/route-entry-webpack/public-packs
cp -R ssr-generated tmp/rsc-size-comparison/route-entry-webpack/ssr-generated
```

Both builds completed. The released build emitted the existing RSC
client-reference chunk-group warnings. The experimental build removed those
warnings and emitted the route benchmark manifest.

## Per-Page RSC Payload

Cached and uncached URL variants are grouped because their browser JS/CSS asset
sets are the same.

| Page / component | Released JS | Released CSS | Released total | Experiment JS | Experiment CSS | Experiment total | Delta total | Gzip delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/rsc`<br>`SimpleServerComponent` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |
| `/blog/rsc`, `/blog/rsc-cached`<br>`BlogPostRSC` | 12.0 KiB | 0.0 KiB | 12.0 KiB | 19.4 KiB | 0.0 KiB | 19.4 KiB | +7.3 KiB (+60.9%) | +0.1 KiB |
| `/blog/rsc-simple`, `/blog/rsc-simple-cached`<br>`BlogPostRSCSimple` | 12.0 KiB | 0.0 KiB | 12.0 KiB | 19.4 KiB | 0.0 KiB | 19.4 KiB | +7.4 KiB (+61.0%) | +0.1 KiB |
| `/blog/rsc-step1`<br>`BlogRSCStep1` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |
| `/blog/rsc-step1b`<br>`BlogRSCStep1b` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |
| `/blog/rsc-step1c`<br>`BlogRSCStep1c` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |
| `/blog/rsc-step2`<br>`BlogRSCStep2` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |
| `/blog/rsc-step3`<br>`BlogRSCStep3` | 3.7 KiB | 0.0 KiB | 3.7 KiB | 11.5 KiB | 0.0 KiB | 11.5 KiB | +7.8 KiB (+212.8%) | +2.8 KiB |
| `/blog/rsc-step4`<br>`BlogRSCStep4` | 3.7 KiB | 0.0 KiB | 3.7 KiB | 11.5 KiB | 0.0 KiB | 11.5 KiB | +7.8 KiB (+212.8%) | +2.8 KiB |
| `/blog/rsc-step5`<br>`BlogRSCStep5` | 3.7 KiB | 0.0 KiB | 3.7 KiB | 11.5 KiB | 0.0 KiB | 11.5 KiB | +7.8 KiB (+212.8%) | +2.8 KiB |
| `/css-demo/one/rsc-client`<br>`CssPageOneClientCss` | 0.9 KiB | 0.0 KiB | 0.9 KiB | 8.7 KiB | 601 KiB | 609 KiB | +608 KiB (+65226.2%) | +82.7 KiB |
| `/css-demo/two/rsc-client`<br>`CssPageTwoClientCss` | 0.9 KiB | 0.0 KiB | 0.9 KiB | 8.7 KiB | 601 KiB | 609 KiB | +608 KiB (+65225.9%) | +82.7 KiB |
| `/css-demo/one/rsc-server`<br>`CssPageOneServerCss` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.2 KiB | 601 KiB | 601 KiB | +601 KiB (new) | +80.2 KiB |
| `/css-demo/two/rsc-server`<br>`CssPageTwoServerCss` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.2 KiB | 601 KiB | 601 KiB | +601 KiB (new) | +80.2 KiB |
| `/media-gallery`, `/media-gallery/rsc`<br>`MediaGalleryRSC` | 96.1 KiB | 0.0 KiB | 96.1 KiB | 106 KiB | 0.0 KiB | 106 KiB | +10.1 KiB (+10.5%) | +1.1 KiB |
| `/product/rsc`, `/product/rsc-cached`<br>`ProductPageRSC` | 9.4 KiB | 0.0 KiB | 9.4 KiB | 17.1 KiB | 0.0 KiB | 17.1 KiB | +7.7 KiB (+81.4%) | +1.8 KiB |
| `/product-search/rsc`, `/product-search/rsc-cached`<br>`ProductSearchRSC` | 27.6 KiB | 0.0 KiB | 27.6 KiB | 35.3 KiB | 0.0 KiB | 35.3 KiB | +7.7 KiB (+27.8%) | +1.7 KiB |
| `/restaurant/:id/rsc`, `/restaurant/:id/rsc-cached`<br>`RestaurantDetailRSC` | 0.0 KiB | 0.0 KiB | 0.0 KiB | 0.1 KiB | 0.0 KiB | 0.1 KiB | +0.1 KiB (new) | +0.1 KiB |

## Interpretation

The current prototype is not a JS-size win in this demo. For non-CSS RSC pages,
it is usually a small JS increase because the generated route entry is an extra
wrapper around route-discovered client boundaries. The gzip impact is much
smaller than the raw delta on the blog pages because the wrapper bundles mostly
compressible code that overlaps conceptually with the released client-reference
chunks.

The useful signal is CSS completeness. The released client-reference manifest in
this build reports `0.0 KiB` CSS for every RSC route. The experimental route
entry exposes the CSS imported by server components, and it also exposes CSS
from client boundary modules when those modules are pulled through the generated
route entry.

The CSS demo numbers are intentionally large because `cssShared.css`, `cssA.css`,
and `cssB.css` are benchmark files. For `/css-demo/one/rsc-server` and
`/css-demo/two/rsc-server`, the experimental adapter finds the two CSS files
needed by each page:

- page one: shared CSS + A CSS;
- page two: shared CSS + B CSS.

That is why those rows move from `0.0 KiB` CSS in the released plugin manifest
to `601 KiB` raw CSS in the experiment. This should be read as "the experiment
can see and carry CSS the released manifest misses", not as "the experiment
always adds 601 KiB to real pages".

## Follow-Up Work Before Runtime Use

This branch is still benchmark-only. Before treating the route-entry assets as
real browser downloads, the runtime integration would need to decide how Rails
or React on Rails selects and links the generated route entry for the current
RSC component.

The current benchmark also shows two implementation improvements worth doing
before shipping this strategy:

- Do not emit a route entry for routes with no client references and no server
  CSS, or emit a metadata-only entry. Those routes currently pay a tiny
  `0.1 KiB` JS stub in the comparison.
- Reduce the route-entry wrapper overhead for routes that only need existing
  client-reference chunks. In the current prototype, most non-CSS pages are
  larger than released mode even though their gzip delta is small.

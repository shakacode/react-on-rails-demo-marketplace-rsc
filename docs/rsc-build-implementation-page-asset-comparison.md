# Page Asset Comparison For RSC Build Implementations

This document records the page-level initial JS/CSS transfer comparison between:

- `release`: the released `react-on-rails-rsc` plugin + loader
- `module_graph`: the experimental plugin + loader implemented on this branch

Scope:

- webpack production build only
- initial page load only
- `/packs/` JavaScript and CSS assets only
- transfer size, not raw file size

`module_graph` is webpack-only in this branch, so this comparison does not cover rspack.
It also does not cover `route_entry`; see
[`docs/rsc-route-entry-size-comparison.md`](./rsc-route-entry-size-comparison.md)
for that benchmark-only comparison.

## Measurement method

For each implementation:

1. Build a production bundle.
2. Boot the Node renderer and Rails in production.
3. Open each RSC route in Puppeteer with cache disabled.
4. Record all `/packs/` JS and CSS responses from Chrome DevTools Protocol network events.
5. Sum the transferred bytes per page.

Commands used:

```bash
mise exec -- pnpm build:production
BASE_URL=http://127.0.0.1:5000 node scripts/measure-rsc-implementation-assets.mjs release .lh-results/rsc-implementation-assets-release.json

RSC_BUILD_IMPLEMENTATION=module_graph mise exec -- pnpm build:production
BASE_URL=http://127.0.0.1:5000 node scripts/measure-rsc-implementation-assets.mjs module-graph .lh-results/rsc-implementation-assets-module-graph.json
```

## Results

| Page | Release JS (KB) | Branch JS (KB) | Release CSS (KB) | Branch CSS (KB) | Release total (KB) | Branch total (KB) | Delta total (KB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home RSC | 262.6 | 262.6 | 154.8 | 154.8 | 417.4 | 417.4 | 0.0 |
| Media Gallery RSC | 366.9 | 366.9 | 154.8 | 154.8 | 521.7 | 521.7 | 0.0 |
| Restaurant RSC | 262.6 | 262.6 | 154.8 | 154.8 | 417.4 | 417.4 | 0.0 |
| Product RSC | 272.3 | 272.3 | 154.8 | 154.8 | 427.1 | 427.1 | 0.0 |
| Product Search RSC | 290.5 | 290.5 | 154.8 | 154.8 | 445.3 | 445.3 | 0.0 |
| Blog RSC | 275.1 | 275.1 | 154.8 | 154.8 | 429.9 | 429.9 | 0.0 |
| Blog RSC Simple | 275.1 | 275.1 | 154.8 | 154.8 | 429.9 | 429.9 | 0.0 |
| CSS Demo One RSC Server | 262.6 | 262.6 | 755.6 | 755.6 | 1018.2 | 1018.2 | 0.0 |
| CSS Demo Two RSC Server | 262.6 | 262.6 | 755.6 | 755.6 | 1018.2 | 1018.2 | 0.0 |
| CSS Demo One RSC Client | 263.8 | 263.8 | 154.8 | 755.6 | 418.6 | 1019.4 | 600.8 |
| CSS Demo Two RSC Client | 263.8 | 263.8 | 154.8 | 755.6 | 418.6 | 1019.4 | 600.8 |

## What the numbers say

The important pattern is simple:

- 9 of 11 measured pages are byte-for-byte identical.
- JS is unchanged on every measured page.
- The only deltas are the two `rsc-client` CSS demo pages.

That matches the code on this branch:

- JS chunk mapping still follows the released chunk-group strategy.
- The meaningful change here is CSS association and CSS emission, not JS chunk reduction.

## Why the server CSS demo pages are identical

The two `rsc-server` CSS demo pages already load the needed CSS in both modes.

In the released path, the demo now falls back to carrier packs:

- page one: `css_demo_one`
- page two: `css_demo_two`

In the `module_graph` path, the demo can instead use manifest-derived `serverComponentCss`.

Either way, the browser ends up downloading the same CSS files:

- page one server: `7981-3a1507d5.css` + `1257-a69cd470.css`
- page two server: `7981-3a1507d5.css` + `5408-948f74f0.css`

So those pages are expected to measure the same.

## Why the client CSS demo pages changed

These two pages expose the actual behavior difference.

### `release`

`/css-demo/one/rsc-client` and `/css-demo/two/rsc-client` download only:

- `application-60148dc6.css`
- `markdown-libs-ae52f22b.css`

They do **not** download the component CSS files for:

- `cssShared.css`
- `cssA.css`
- `cssB.css`

A browser-level verification confirmed the component styles are missing on these pages under `release`:

- `CssSharedClient` outline width: `0px`
- `CssBlockAClient` outline width: `0px`
- `CssBlockBClient` outline width: `0px`

### `module_graph`

Under `module_graph`, the pages download the exact component CSS they render:

- `/css-demo/one/rsc-client`:
  - `7981-3a1507d5.css`
  - `1257-a69cd470.css`
- `/css-demo/two/rsc-client`:
  - `7981-3a1507d5.css`
  - `5408-948f74f0.css`

The same browser-level verification confirmed the styles now apply:

- `CssSharedClient` outline width: `7px`
- `CssBlockAClient` outline width: `11px`
- `CssBlockBClient` outline width: `13px`

That is why each of the two client demo pages gains about `600.8 KB` of CSS transfer: the branch is shipping CSS that the released path failed to ship at all.

## Interpretation

This branch does **not** show a JS byte reduction on this demo yet.

It also does **not** reduce total transferred CSS on the measured pages. In fact, it increases CSS transfer on two routes. But that increase is tied to a correctness fix: those routes were previously unstyled because their component CSS never reached the browser.

So the result for this branch is:

- no measured JS win yet
- no measured CSS-size win yet
- real correctness win for client-component CSS on the CSS demo routes
- real correctness win for server-component CSS delivery, but the demo's release fallback hides that in page-byte totals

## Bottom line

For this branch implementation, issue #130's "ship fewer bytes" hypothesis is not proven yet on this demo.

What this branch does prove is narrower:

- module-driven CSS association can deliver exact component CSS that the released chunk-driven path misses
- the measured byte delta comes from making missing CSS show up, not from broader JS chunk changes

If the next experiment wants a byte-reduction result, it has to change the JS side too: boundary discovery and component-to-chunk mapping, not just CSS association.

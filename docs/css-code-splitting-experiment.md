# CSS code-splitting under SSR vs RSC — does each page download only the CSS it needs?

Experiment to test whether the webpack CSS pipeline + the React on Rails RSC plugin ship **only the
per-component CSS each page actually uses**, and how SSR and RSC differ. The demo normally styles
everything with one global Tailwind bundle, which hides per-component CSS behaviour — so this
introduces large per-component CSS files instead.

## Setup

Three large CSS files (~300 KB raw / ~42 KB gzip each, unique non-compressible rules, each carries a
greppable `SENTINEL_*` string and a `*_marker` class with a distinctive `outline-width` for
ground-truth "did it apply?" checks):

- `cssShared.css` — **shared** by both pages (marker outline 7px)
- `cssA.css` — **only** page one (marker 11px)
- `cssB.css` — **only** page two (marker 13px)

Leaf components import one CSS file each (`CssShared`/`CssBlockA`/`CssBlockB`, plus `*Client` variants
with `'use client'`). Two pages × three rendering shapes (registered components in `app/javascript/startup/`):

| Route | Shape | Renders |
|---|---|---|
| `/css-demo/{one,two}/ssr` | SSR `react_component` (client component) | Shared + A / Shared + B |
| `/css-demo/{one,two}/rsc-server` | RSC `stream_react_component`, CSS imported by **server** components | Shared + A / Shared + B |
| `/css-demo/{one,two}/rsc-client` | RSC streamed, CSS imported by nested **`'use client'`** leaves | Shared + A / Shared + B |

Page one = Shared + A, page two = Shared + B (so `cssShared` is shared, `cssA`/`cssB` are per-page).
Measured on a **production build** (`:5000`, minified) with Chrome DevTools network capture + a
`getComputedStyle(outline-width)` check on each block (7/11/13 px = the file loaded and applied;
0 px = element present but its CSS never arrived). CSS chunks identified by their `SENTINEL_*` content,
not filename (splitChunks renames/duplicates).

## Results

| Page | CSS files downloaded | Applied (outline-width) | Needed vs downloaded |
|---|---|---|---|
| one / ssr | `cssShared` + `cssA` | shared 7px, A 11px | **exactly needed** ✅ |
| two / ssr | `cssShared` + `cssB` | shared 7px, B 13px | **exactly needed** ✅ |
| one / rsc-server | *(none of the module CSS)* | shared **0px**, A **0px** (unstyled) | **under-fetch** ❌ |
| two / rsc-server | *(none of the module CSS)* | unstyled (0px) | **under-fetch** ❌ |
| one / rsc-client | `cssShared` + `cssA` | shared 7px, A 11px | **exactly needed** ✅ |
| two / rsc-client | `cssShared` + `cssB` | shared 7px, B 13px | **exactly needed** ✅ |

(Every page also loads the global `application.css` (Tailwind, ~113 KB) and a 2 KB markdown chunk.
Module files transfer uncompressed (~300 KB each) in this local static-file setup; a CDN/gzip would
send ~42 KB.)

## Answer: does each page download only the CSS it needs?

- **SSR (client components): YES — exactly the needed CSS.** Page one downloads `cssShared` + `cssA`
  and **not** `cssB`; page two downloads `cssShared` + `cssB` and **not** `cssA`. The shared file is
  downloaded **once**. No over-fetch, no under-fetch — and the styles apply.
- **RSC with CSS imported by `'use client'` components: YES — identical to SSR.** Per-page splitting
  and shared-file dedup both work; the right CSS downloads and applies.
- **RSC with CSS imported by pure SERVER components: NO — it downloads *less* than needed (under-fetch).**
  None of the per-component CSS reaches the client, so the server-rendered markup is **unstyled**
  (outline 0px). The class names are emitted in the HTML/RSC payload, but the stylesheet defining them
  is never sent to the browser.

So: **no page ever over-fetches** (page one never pulls page two's CSS, and shared CSS loads once).
The only failure mode is the RSC **server-component** path, which *under*-fetches — the CSS is missing
entirely.

## Why (mechanism)

- A **client** component's generated pack imports the component
  (`import Foo from 'startup/Foo.client'; ReactOnRails.register({Foo})`), so its imported CSS rides in
  the `generated/Foo` client chunk; react_on_rails' `load_pack_for_generated_component` calls
  `append_stylesheet_pack_tag('generated/Foo')` per rendered component, so each page links only the CSS
  for the components it renders. Shared CSS is extracted by `splitChunks {chunks:'all'}` into a chunk
  both pages share.
- A **server** component's generated pack is only `registerServerComponent("Foo")` (no import), so the
  component — and its CSS — exist **only in the server/RSC bundle**, never the client. Streamed body
  chunks can't append `<head>` stylesheet tags after the head is flushed, so server-component CSS has
  no path to the client.
- **`'use client'` leaves inside an RSC tree** are client references: the webpack RSC plugin records
  their CSS in `react-client-manifest.json`, React emits stylesheet (`S`) hints in the flight stream,
  and the browser loads exactly those files — which is why `rsc-client` matches SSR.

## Implications / recommendations

- In RSC, **import per-component CSS from a `'use client'` component (or use global CSS)** if it must
  style client-visible markup. **CSS imported by a pure server component will not reach the browser**
  and the markup renders unstyled (today this is masked only because everything also gets global
  Tailwind). This is the key gotcha to document for RSC adopters.
- Per-page CSS splitting + shared-file dedup work well for SSR and RSC-client — pages pay only for the
  CSS of the components they render.
- Build note: because `cssShared` is imported via two different client boundaries (the SSR client
  component and the `'use client'` leaf), it is emitted into **two** client chunks. Any single page
  loads only one copy, but the build ships the shared CSS twice across the two paths — consolidate the
  import path (one shared client component) if that matters.

(Design and predictions cross-reviewed with Codex gpt-5.5 @ xhigh; measured results matched its
predictions for all three shapes.)

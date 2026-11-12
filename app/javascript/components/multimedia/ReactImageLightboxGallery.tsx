// ReactImageLightboxGallery — GALLERY demo #1: react-image-lightbox.
//
// NO 'use client' (directive lives in ReactImageLightboxGalleryForServer.tsx).
//
// ─── WHY THIS LIBRARY IS HERE (from the lightbox investigation) ──────────────
// react-image-lightbox is DEPRECATED and its repo is archived (last release
// 5.1.4, July 2021) yet still pulls ~130k downloads/week, so plenty of real apps
// still ship it. We render it here purely as the BEFORE in a before/after against
// its maintained successor (yet-another-react-lightbox, the next gallery). The
// investigation's recommendation was to migrate to that successor; this page
// lets you compare them in the same context.
//
// ─── SSR SAFETY NOTE ─────────────────────────────────────────────────────────
// react-image-lightbox calls global.window/new global.Image() *during render* of
// its <Lightbox>. That's fine here for two reasons:
//   1. We only mount <Lightbox> when an image is open (index !== null) — which is
//      a client-only state, so it never renders during SSR/RSC prerender.
//   2. This repo bundles with rspack (node.global = true), so `global` resolves
//      in the browser bundle. (Under Vite/esbuild it would need a `global`
//      shim — a gotcha the investigation hit and worth remembering.)
// Its stylesheet is imported globally in stylesheets/application.css (not here),
// matching how the repo handles vendor CSS (e.g. highlight.js).
import React, { useState } from 'react';
import Lightbox from 'react-image-lightbox';
import { LightboxThumbGrid } from './LightboxThumbGrid';
import type { GalleryImage } from './types';

interface Props {
  images: GalleryImage[];
}

export function ReactImageLightboxGallery({ images }: Props) {
  // null = closed (the SSR/initial state → <Lightbox> not mounted).
  const [index, setIndex] = useState<number | null>(null);
  const count = images.length;
  const current = index ?? 0;

  return (
    <>
      <LightboxThumbGrid images={images} onOpen={setIndex} label="react-image-lightbox" />

      {index !== null && (
        <Lightbox
          mainSrc={images[current].full_src}
          nextSrc={images[(current + 1) % count].full_src}
          prevSrc={images[(current + count - 1) % count].full_src}
          onCloseRequest={() => setIndex(null)}
          onMovePrevRequest={() => setIndex((current + count - 1) % count)}
          onMoveNextRequest={() => setIndex((current + 1) % count)}
          imageTitle={images[current].alt}
          imageCaption={images[current].caption}
        />
      )}
    </>
  );
}

// YetAnotherLightboxGallery — GALLERY demo #2: yet-another-react-lightbox.
//
// NO 'use client' (directive lives in YetAnotherLightboxGalleryForServer.tsx).
//
// ─── WHY THIS LIBRARY (the recommended successor) ────────────────────────────
// yet-another-react-lightbox (v3, ~448k downloads/week) is the actively-
// maintained replacement the investigation recommended over react-image-lightbox.
// It declares React 16–19 peer deps, is SSR-safe by design, and has a cleaner
// controlled API: a single <Lightbox open index slides close/> instead of the
// older library's mainSrc/prevSrc/nextSrc + six move/close callbacks. Compare
// the two source files side by side to feel the difference.
//
// Its stylesheet is imported globally in stylesheets/application.css.
import React, { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import { LightboxThumbGrid } from './LightboxThumbGrid';
import type { GalleryImage } from './types';

interface Props {
  images: GalleryImage[];
}

export function YetAnotherLightboxGallery({ images }: Props) {
  // -1 = closed. yet-another-react-lightbox renders nothing when open={false},
  // so this is SSR-safe even though we always include the element in the tree.
  const [index, setIndex] = useState(-1);

  // The full-resolution slides. width/height let the lightbox size correctly.
  const slides = images.map((img) => ({
    src: img.full_src,
    alt: img.alt,
    description: img.caption,
    width: 1600,
    height: 1067,
  }));

  return (
    <>
      <LightboxThumbGrid images={images} onOpen={setIndex} label="yet-another-react-lightbox" />

      <Lightbox
        open={index >= 0}
        index={index < 0 ? 0 : index}
        close={() => setIndex(-1)}
        slides={slides}
      />
    </>
  );
}

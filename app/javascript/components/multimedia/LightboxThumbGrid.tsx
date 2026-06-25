// LightboxThumbGrid — the responsive thumbnail grid shared by BOTH galleries.
//
// NO 'use client' — it has no browser state of its own; it just renders <img>
// thumbnails and calls back with the clicked index. It's pulled into the client
// graph by whichever gallery island imports it.
//
// This is where the issue's IMAGE acceptance criteria are satisfied:
//   • responsive srcset/sizes  → browser downloads the smallest file that fills
//     the slot (big mobile bandwidth saving)
//   • explicit width/height    → the box is reserved at intrinsic 3:2 ratio, so
//     the grid never reflows as images decode → CLS ~0
//   • lazy loading below the fold → only the first row loads eagerly
import React from 'react';
import type { GalleryImage } from './types';

interface Props {
  images: GalleryImage[];
  onOpen: (index: number) => void;
  // Used only for accessible labels so screen-reader users know which lightbox.
  label: string;
}

export function LightboxThumbGrid({ images, onOpen, label }: Props) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
      {images.map((img, index) => (
        <li key={img.id}>
          <button
            type="button"
            onClick={() => onOpen(index)}
            aria-label={`Open image ${index + 1} of ${images.length} in the ${label} lightbox`}
            className="group block w-full overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <img
              src={img.thumb_src}
              srcSet={img.srcset}
              sizes={img.sizes}
              width={img.width}
              height={img.height}
              alt={img.alt}
              // First row (4 thumbs on desktop) is likely above the fold.
              loading={index < 4 ? 'eager' : 'lazy'}
              decoding="async"
              className="aspect-[3/2] w-full object-cover transition duration-300 group-hover:scale-105"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

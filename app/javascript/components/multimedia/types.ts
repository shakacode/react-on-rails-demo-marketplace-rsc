// Shared types for the /media-gallery RSC page.
//
// NO 'use client' here — this file is plain type declarations imported by both
// the server component (MediaGalleryRSC) and the client islands. Types are
// erased at build time, so it lands in neither bundle's runtime.
//
// Keys are snake_case because they come straight from MediaGalleryData (Ruby).
// We keep the wire shape verbatim rather than camelCasing in a mapping layer —
// same convention the restaurant/product pages use.

export interface VideoManifest {
  src: string;
  poster: string;
  title: string;
  width: number;
  height: number;
}

export interface GalleryImage {
  id: string;
  thumb_src: string;
  srcset: string;
  sizes: string;
  width: number;
  height: number;
  full_src: string;
  alt: string;
  caption: string;
}

export interface MediaGalleryProps {
  intro_markdown: string;
  closing_markdown: string;
  react_player_video: VideoManifest;
  vanilla_video: VideoManifest;
  ril_gallery: GalleryImage[];
  yarl_gallery: GalleryImage[];
}

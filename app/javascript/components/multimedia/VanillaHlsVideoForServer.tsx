'use client';

// ForServer wrapper — the 'use client' boundary for VanillaHlsVideo.
// MediaGalleryRSC (server) imports this; hls.js (lazy-loaded inside the island)
// is thereby kept entirely in the client graph.
export { VanillaHlsVideo } from './VanillaHlsVideo';

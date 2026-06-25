'use client';

// ForServer wrapper — the 'use client' boundary for ReactPlayerLightVideo.
// The RSC server component (MediaGalleryRSC) imports THIS file; everything it
// pulls in (react-player, loaded lazily inside the island) becomes client code
// and stays out of the RSC bundle. Same pattern as ProductImageGalleryForServer.
export { ReactPlayerLightVideo } from './ReactPlayerLightVideo';

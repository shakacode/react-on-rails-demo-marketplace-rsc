// ReactPlayerLightVideo — VIDEO demo #1: react-player v3 in "light" (facade) mode.
//
// NO 'use client' directive here on purpose. This is the repo's client-island
// convention: the interactive component carries no directive and is pulled into
// the client graph through its sibling *ForServer.tsx wrapper (which DOES carry
// 'use client'). See ProductImageGallery / ProductImageGalleryForServer for the
// same split. That keeps the RSC page's chunk group clean.
//
// ─── WHY THIS IS BUILT THE WAY IT IS (from the react-player web-vitals study) ───
// The v2-vs-v3 benchmark found react-player v3 ships ~90 KB more critical JS than
// v2 and bundles hls.js (~162 KB) as a SAME-ORIGIN chunk. With a naive mount,
// that JS sits on the critical path and LCP regresses badly under CPU throttle
// (desktop-4×: ~800 ms vs ~180 ms) — the player must download → parse → execute →
// upgrade its custom element before the poster even paints. Two fixes from that
// study are applied here:
//
//   1. LIGHT MODE (light={poster}). react-player renders ONLY the poster + a play
//      icon and defers downloading the hls.js engine until the user clicks. For a
//      page that could hold many videos, that's the biggest bandwidth/LCP win —
//      N posters instead of N streaming engines.
//
//   2. DEFER THE PLAYER MODULE ITSELF. We import('react-player') lazily, after
//      hydration, client-side only. Benefits: (a) react-player builds on
//      web-component custom elements that assume a browser, so keeping it out of
//      SSR avoids fragility; (b) the server-rendered poster paints first and is
//      the LCP element; (c) the player JS never blocks first paint. While the
//      lazy chunk loads we also hand react-player `fallback={<poster img>}` —
//      the study specifically flagged that v3's default Suspense fallback is
//      `null`, so nothing paints during load unless you supply an <img>.
import React, { useEffect, useState, type ComponentType } from 'react';
import type { VideoManifest } from './types';

// react-player v3's prop types are broad; we only need it as a component here.
type ReactPlayerComponent = ComponentType<Record<string, unknown>>;

interface Props {
  video: VideoManifest;
  // First video on the page → its poster is the likely LCP element, so load it
  // eagerly with high priority. Below-the-fold videos stay lazy.
  priority?: boolean;
}

// Plain poster image that fills the 16:9 box. Server-rendered (and shown while
// react-player's lazy chunk loads) so the slot is never empty → CLS ~0, fast LCP.
function PosterImage({ video, priority }: { video: VideoManifest; priority?: boolean }) {
  return (
    <img
      src={video.poster}
      alt={`Poster frame for ${video.title}`}
      width={video.width}
      height={video.height}
      className="absolute inset-0 h-full w-full object-cover"
      // fetchPriority/loading mirror the LCP guidance used elsewhere in the repo
      // (SearchResultCard, ProductImageGallery).
      fetchPriority={priority ? 'high' : 'auto'}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export function ReactPlayerLightVideo({ video, priority }: Props) {
  const [Player, setPlayer] = useState<ReactPlayerComponent | null>(null);

  useEffect(() => {
    let alive = true;
    // Dynamic import → react-player lands in its own chunk, fetched only after
    // this island hydrates (never during SSR, never on the critical path).
    import('react-player')
      .then((mod) => {
        if (alive) setPlayer(() => mod.default as ReactPlayerComponent);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <figure className="m-0">
      {/* Fixed 16:9 box reserves the slot BEFORE the player or poster loads. */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-slate-900 shadow-sm ring-1 ring-slate-200"
        style={{ aspectRatio: '16 / 9' }}
      >
        {Player ? (
          <Player
            src={video.src}
            // ── light/facade mode: poster + play icon, hls.js loaded on click ──
            light={video.poster}
            // ── fallback that paints while react-player's lazy chunk loads ──
            fallback={<PosterImage video={video} priority={priority} />}
            controls
            playsInline
            width="100%"
            height="100%"
            previewAriaLabel={`Play ${video.title}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        ) : (
          // SSR + pre-hydration: just the poster.
          <PosterImage video={video} priority={priority} />
        )}
      </div>
      <figcaption className="mt-2 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{video.title}.</span>{' '}
        Click to play — the hls.js engine and the player module are both fetched
        on demand (light/facade mode), so the page loads only this poster frame.
      </figcaption>
    </figure>
  );
}

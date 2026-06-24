// VanillaHlsVideo — VIDEO demo #2: a hand-rolled <video> + hls.js, no player lib.
//
// NO 'use client' (same client-island convention as ReactPlayerLightVideo —
// the directive lives in VanillaHlsVideoForServer.tsx).
//
// ─── WHY THIS EXISTS / WHAT THE EXPERIMENTS TAUGHT ───────────────────────────
// The "best-of-both" hls.js study showed you don't need a player library at all
// for hosted HLS. The cross-browser core is tiny and well-understood:
//
//   • DETECTION ORDER: try Hls.isSupported() (MSE path) FIRST, native HLS
//     (canPlayType('application/vnd.apple.mpegurl')) only as a fallback. This is
//     deliberately the OPPOSITE of "check native first to save the download":
//     desktop Chrome's canPlayType returns "maybe" for HLS, so a native-first
//     order silently SKIPS hls.js on the very browsers that need it — a real bug
//     the vanilla benchmark hit (its great numbers were native playback, not the
//     hls.js path most users actually take). MSE-first = consistent everywhere.
//
//   • FACADE / DEFERRED LOAD: hls.js (~162 KB) is dynamically import()ed only on
//     the first user click, and <video preload="none"> means no media bytes are
//     fetched until then either. Same light-mode win as the react-player demo,
//     done by hand: the page initially ships ZERO video JS — just a poster.
//
//   • CLS: the <video> lives in a fixed 16:9 box with a real poster, so the slot
//     never reflows when playback finally attaches.
//
//   • CLEANUP: hls.destroy() on unmount (SPA-safe; avoids leaked buffers/loaders).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { VideoManifest } from './types';

interface Props {
  video: VideoManifest;
}

export function VanillaHlsVideo({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [active, setActive] = useState(false);

  // Tear down hls.js when the component unmounts (route change / navigation).
  useEffect(
    () => () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    },
    [],
  );

  const activate = useCallback(async () => {
    const el = videoRef.current;
    if (!el || active) return;
    setActive(true);

    // Dynamic import → hls.js is a separate chunk fetched only now, on demand.
    const { default: HlsLib } = await import('hls.js');

    if (HlsLib.isSupported()) {
      // MSE path (Chrome/Firefox/desktop Safari/Android): hls.js feeds the buffer.
      const hls = new HlsLib({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(video.src);
      hls.attachMedia(el);
      // Autoplay (muted policy already satisfied below) once the manifest is in.
      hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        el.play().catch(() => undefined);
      });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS fallback (iOS Safari / older Safari with no MSE): just set src.
      el.src = video.src;
      el.play().catch(() => undefined);
    }
  }, [active, video.src]);

  return (
    <figure className="m-0">
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-slate-200"
        style={{ aspectRatio: '16 / 9' }}
      >
        <video
          ref={videoRef}
          poster={video.poster}
          width={video.width}
          height={video.height}
          // controls appear only once activated so the facade owns the first click.
          controls={active}
          playsInline
          muted
          // No media bytes until the user plays.
          preload="none"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Click-to-load facade: a play button over the poster. Hidden once
            activated. This is what defers BOTH the hls.js download and the media
            bytes until intent is shown. */}
        {!active && (
          <button
            type="button"
            onClick={activate}
            aria-label={`Play ${video.title}`}
            className="group absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/0"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/30 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-black/70">
              <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{video.title}.</span>{' '}
        Feature-detected (MSE-first, native HLS fallback). hls.js is downloaded
        only on click; the page ships no video JS up front.
      </figcaption>
    </figure>
  );
}

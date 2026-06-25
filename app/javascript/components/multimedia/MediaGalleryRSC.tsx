// MediaGalleryRSC — the /media-gallery page. A React SERVER component.
//
// No 'use client' — this is the RSC bundle. Everything in this file runs on the
// server and streams as HTML: the layout, the section copy, and the markdown
// (rendered with marked + sanitize-html HERE, so those libs never reach the
// browser — the lint:rsc check enforces that). The only JavaScript the page
// ships is the four media widgets below, each a small client island reached via
// its *ForServer wrapper. That is the "use server components as much as possible"
// goal made concrete: server-render everything that doesn't need the browser.
import React from 'react';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';
import { ReactPlayerLightVideo } from './ReactPlayerLightVideoForServer';
import { VanillaHlsVideo } from './VanillaHlsVideoForServer';
import { ReactImageLightboxGallery } from './ReactImageLightboxGalleryForServer';
import { YetAnotherLightboxGallery } from './YetAnotherLightboxGalleryForServer';
import type { MediaGalleryProps } from './types';

// Server-rendered prose. marked + highlight.js + sanitize-html all run on the
// server inside this function; the client receives only sanitized HTML.
function Prose({ markdown }: { markdown: string }) {
  return (
    <div
      className="prose prose-slate max-w-none"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderSanitizedMarkdown(markdown) }}
    />
  );
}

// Small server-rendered section header so each demo explains what it shows.
function SectionHeader({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <div className="mb-5">
      <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
        {kicker}
      </span>
      <h2 className="mt-3 text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-3xl text-slate-500">{blurb}</p>
    </div>
  );
}

export default function MediaGalleryRSC(props: MediaGalleryProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-5xl space-y-16 px-4 py-10 sm:py-14">
        {/* Intro — pure server-rendered markdown, zero JS. */}
        <header>
          <Prose markdown={props.intro_markdown} />
        </header>

        {/* ── VIDEO 1: react-player v3, light/facade mode ── */}
        <section>
          <SectionHeader
            kicker="Video · react-player v3"
            title="Light mode (facade)"
            blurb="react-player renders just the poster + a play icon; the hls.js engine and the player module are both fetched on click. The poster is a real video frame from Mux's image service."
          />
          {/* priority: first video on the page → its poster is the likely LCP. */}
          <ReactPlayerLightVideo video={props.react_player_video} priority />
        </section>

        {/* ── VIDEO 2: vanilla <video> + hls.js ── */}
        <section>
          <SectionHeader
            kicker="Video · hand-rolled"
            title="Vanilla <video> + hls.js"
            blurb="No player library. Feature-detected (MSE-first, native-HLS fallback), with hls.js dynamically imported only on the first click. The poster is self-supplied because this raw test stream has no thumbnail service."
          />
          <VanillaHlsVideo video={props.vanilla_video} />
        </section>

        {/* ── GALLERY 1: react-image-lightbox (deprecated) ── */}
        <section>
          <SectionHeader
            kicker="Gallery · react-image-lightbox"
            title="The deprecated incumbent"
            blurb="A responsive thumbnail grid (srcset/sizes, explicit dimensions, lazy below the fold) wired to react-image-lightbox — archived since 2023 but still widely used. Click any thumbnail."
          />
          <ReactImageLightboxGallery images={props.ril_gallery} />
        </section>

        {/* ── GALLERY 2: yet-another-react-lightbox (recommended successor) ── */}
        <section>
          <SectionHeader
            kicker="Gallery · yet-another-react-lightbox"
            title="The maintained successor"
            blurb="The same grid wired to yet-another-react-lightbox — actively maintained, React-19-ready, SSR-safe, with a cleaner controlled API. This is the recommended replacement."
          />
          <YetAnotherLightboxGallery images={props.yarl_gallery} />
        </section>

        {/* Closing notes — server-rendered markdown. */}
        <footer className="border-t border-slate-200 pt-10">
          <Prose markdown={props.closing_markdown} />
        </footer>
      </div>
    </div>
  );
}

// NO 'use client' — this module is imported by both server (RSC tree) and
// client ('use client' tree) variants. Importing it from a 'use client' file
// is *intentional* on SSR/Client variants of /restaurant/:id and /product/:id:
// it ships marked + highlight.js + sanitize-html to the browser as the
// comparison baseline against the RSC variants, which call the same function
// server-side and ship only HTML.
//
// The chunk-contamination check exempts this file because it has no
// 'use client' directive and is reached from non-'use client' callers in the
// RSC tree as well as from 'use client' callers in the SSR/Client trees.
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import sanitizeHtml from 'sanitize-html';

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'span', 'img', 'figure', 'figcaption',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    code: ['class'],
    span: ['class'],
    pre: ['class'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

/**
 * Render markdown to a sanitized HTML string. Used by both the RSC server tree
 * (where this work happens once on the server) and the SSR/Client trees
 * (where it runs again during browser hydration — that's the demo's whole point).
 */
export function renderSanitizedMarkdown(markdown: string): string {
  const html = marked.parse(markdown) as string;
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

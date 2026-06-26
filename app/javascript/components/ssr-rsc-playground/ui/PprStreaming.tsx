'use client';

import React, { useState, useRef, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Seg = { text: string; color: string };

interface BrowserSection {
  id: string;
  label: string;
  state: 'hidden' | 'skeleton' | 'loaded';
  content?: string;
  bgColor?: string;
  badge?: string;
}

interface StreamStep {
  source: 'cdn' | 'origin';
  title: string;
  desc: string;
  html: string;
  detail: string;
  sections: BrowserSection[];
}

// ── HTML syntax highlighting ─────────────────────────────────────────────────

function tokenizeHtml(raw: string): Seg[] {
  const segs: Seg[] = [];
  let rest = raw;

  while (rest.length > 0) {
    let match: RegExpMatchArray | null;

    if ((match = rest.match(/^<!--.*?-->/s))) {
      segs.push({ text: match[0], color: '#64748b' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^\$RC/))) {
      segs.push({ text: match[0], color: '#fbbf24' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^<\/?[\w!-]+/))) {
      const bracket = match[0].match(/^(<\/?)(.+)/)!;
      segs.push({ text: bracket[1], color: '#94a3b8' });
      segs.push({ text: bracket[2], color: '#f472b6' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^\/?>/))) {
      segs.push({ text: match[0], color: '#94a3b8' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^([\w-]+)(=)/))) {
      segs.push({ text: match[1], color: '#67e8f9' });
      segs.push({ text: match[2], color: '#94a3b8' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^"[^"]*"/))) {
      segs.push({ text: match[0], color: '#86efac' });
      rest = rest.slice(match[0].length);
    } else {
      const nextSpecial = rest.slice(1).search(/<|"|\$RC|<!--/);
      const len = nextSpecial === -1 ? rest.length : nextSpecial + 1;
      segs.push({ text: rest.slice(0, len), color: '#cbd5e1' });
      rest = rest.slice(len);
    }
  }

  return segs;
}

function renderHtml(raw: string, baseColor: string): React.ReactNode {
  const tokens = tokenizeHtml(raw);
  return tokens.map((seg, i) => (
    <span key={i} style={{ color: seg.color === '#cbd5e1' ? baseColor : seg.color }}>{seg.text}</span>
  ));
}

// ── Section helpers ─────────────────────────────────────────────────────────

const H = (id: string, l: string): BrowserSection =>
  ({ id, label: l, state: 'hidden' });
const S = (id: string, l: string): BrowserSection =>
  ({ id, label: l, state: 'skeleton' });
const L = (id: string, l: string, c: string, bg: string, badge?: string): BrowserSection =>
  ({ id, label: l, state: 'loaded', content: c, bgColor: bg, badge });

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS: StreamStep[] = [
  {
    source: 'cdn',
    title: 'Static Shell — Real Content from CDN Cache',
    desc: 'Pre-built at deploy time. Served from CDN edge in ~30ms — no origin server needed.',
    html:
`<!DOCTYPE html>
<html>
<head>
  <link href="/styles.css" rel="stylesheet" />
  <script src="/route-bundle.js" async></script>
</head>
<body>
  <nav class="header">
    <h1>Bella's Pizza</h1>
    <span>4.2 · Open · $$</span>
  </nav>

  <section class="specials">
    <h3>Today's Specials</h3>
    <div>Truffle Pizza — $18.99</div>
    <div>Lobster Ravioli — $24.99</div>
  </section>`,
    detail: 'Header and Specials contain real rendered content — not skeletons. The Specials component uses "await cms.todaysSpecials()" but has no connection()/cookies()/headers() call, so React resolves it at build time and bakes the result into the cached shell. The JS bundle loads with async — it does NOT block rendering.',
    sections: [
      L('header', 'Header', "Bella's Pizza  4.2 · Open", '#e2e8f0'),
      L('specials', 'Specials', 'Truffle Pizza $18.99 | Lobster Ravioli $24.99', '#fef3c7', 'async + cached'),
      H('menu', 'Menu'),
      H('cart', 'Cart'),
      H('reviews', 'Reviews'),
    ],
  },
  {
    source: 'cdn',
    title: 'Skeleton Fallbacks — Still from CDN Cache',
    desc: 'Suspense boundary placeholders are part of the same cached HTML document.',
    html:
`

  <!--$?--><template id="B:0"></template>
  <div class="menu-skeleton">
    <div class="placeholder"></div>
    <div class="placeholder"></div>
  </div>
  <!--/$-->

  <!--$?--><template id="B:1"></template>
  <div class="cart-skeleton">Loading cart...</div>
  <!--/$-->

  <!--$?--><template id="B:2"></template>
  <div class="reviews-skeleton">Loading...</div>
  <!--/$-->`,
    detail: '<!--$?--> and <template id="B:X"> are React\'s Suspense boundary markers. The browser renders skeleton loading states instantly. Meanwhile, the CDN has already connected to the origin server and sent the "postponed" state — the origin is fetching cart data, menu items, and reviews in parallel right now.',
    sections: [
      L('header', 'Header', "Bella's Pizza  4.2 · Open", '#e2e8f0'),
      L('specials', 'Specials', 'Truffle Pizza $18.99 | Lobster Ravioli $24.99', '#fef3c7', 'async + cached'),
      S('menu', 'Menu'),
      S('cart', 'Cart'),
      S('reviews', 'Reviews'),
    ],
  },
  {
    source: 'origin',
    title: 'Cart Resolves — $RC Swaps the Skeleton',
    desc: 'Origin rendered the cart. HTML + scoped CSS + $RC script stream to the browser.',
    html:
`

  <div hidden id="S:1">
    <style data-precedence="cart">
      .cart-widget { display: flex; gap: 8px; }
      .cart-btn { background: #4f46e5; }
    </style>
    <div class="cart-widget">
      Your Cart (2 items) — $27.98
      <button class="cart-btn">Checkout</button>
    </div>
  </div>
  <script>$RC("B:1","S:1")</script>`,
    detail: '$RC (completeBoundary) is a ~500-byte inline function in React\'s streaming runtime. It finds <template id="B:1">, removes the "Loading cart..." skeleton, and moves the real content from the hidden <div> into its place. The <style> block is scoped CSS that arrives WITH the content — no separate stylesheet request needed. Zero React reconciliation — pure DOM manipulation.',
    sections: [
      L('header', 'Header', "Bella's Pizza  4.2 · Open", '#e2e8f0'),
      L('specials', 'Specials', 'Truffle Pizza $18.99 | Lobster Ravioli $24.99', '#fef3c7', 'async + cached'),
      S('menu', 'Menu'),
      L('cart', 'Cart', 'Your Cart (2 items) — $27.98', '#dbeafe'),
      S('reviews', 'Reviews'),
    ],
  },
  {
    source: 'origin',
    title: 'Menu Resolves — Another $RC Swap',
    desc: 'Menu data (DB query with JOINs) resolved. Chunk streams in independently.',
    html:
`

  <div hidden id="S:0">
    <style data-precedence="menu">
      .menu-grid { display: grid; gap: 12px; }
      .menu-item { border-radius: 8px; }
    </style>
    <div class="menu-grid">
      <div class="menu-item">Margherita — $12.99</div>
      <div class="menu-item">Pepperoni — $14.99</div>
      <div class="menu-item">Caesar Salad — $10.99</div>
    </div>
  </div>
  <script>$RC("B:0","S:0")</script>`,
    detail: 'Each boundary resolves independently on the origin server. Cart arrived first (fast session lookup), Menu second (DB query). $RC swaps the menu skeleton with the real grid. Users can scroll and read immediately — buttons become clickable after the JS bundle finishes loading and React hydrates this boundary (~50ms).',
    sections: [
      L('header', 'Header', "Bella's Pizza  4.2 · Open", '#e2e8f0'),
      L('specials', 'Specials', 'Truffle Pizza $18.99 | Lobster Ravioli $24.99', '#fef3c7', 'async + cached'),
      L('menu', 'Menu', 'Margherita | Pepperoni | Caesar Salad', '#d1fae5'),
      L('cart', 'Cart', 'Your Cart (2 items) — $27.98', '#dbeafe'),
      S('reviews', 'Reviews'),
    ],
  },
  {
    source: 'origin',
    title: 'Reviews — Server Component, Zero JS',
    desc: 'External review API responded. Final boundary resolves and the stream closes.',
    html:
`

  <div hidden id="S:2">
    <div class="reviews-summary">
      <span>142 reviews</span>
      <a href="/reviews">See all</a>
    </div>
  </div>
  <script>$RC("B:2","S:2")</script>
</body>
</html>`,
    detail: 'Reviews is a Server Component — it ships zero JavaScript to the browser. After $RC swaps the skeleton, Reviews is immediately interactive (links work, content scrollable). No hydration needed. In SSR, this component would have shipped its rendering code to the browser. In PPR, only the HTML travels. The </html> tag closes the response — the entire page loaded through a single chunked HTTP response from two sources.',
    sections: [
      L('header', 'Header', "Bella's Pizza  4.2 · Open", '#e2e8f0'),
      L('specials', 'Specials', 'Truffle Pizza $18.99 | Lobster Ravioli $24.99', '#fef3c7', 'async + cached'),
      L('menu', 'Menu', 'Margherita | Pepperoni | Caesar Salad', '#d1fae5'),
      L('cart', 'Cart', 'Your Cart (2 items) — $27.98', '#dbeafe'),
      L('reviews', 'Reviews', '142 reviews  ·  See all', '#fae8ff'),
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PprStreaming() {
  const [step, setStep] = useState(0);
  const htmlPanelRef = useRef<HTMLDivElement>(null);

  const cur = STEPS[step];
  const prevHtml = STEPS.slice(0, step).map((s) => s.html).join('');

  useEffect(() => {
    if (htmlPanelRef.current) {
      htmlPanelRef.current.scrollTop = htmlPanelRef.current.scrollHeight;
    }
  }, [step]);

  const sourceColor = cur.source === 'cdn' ? '#10b981' : '#8b5cf6';
  const sourceLabel = cur.source === 'cdn' ? 'CDN Cache' : 'Origin Server';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
        <h3 className="text-lg font-bold text-white">How PPR Streams Your Page</h3>
        <p className="text-indigo-200 text-sm mt-1">
          One HTTP response, two sources — cached shell from CDN + dynamic chunks from origin
        </p>
      </div>

      {/* Step navigation */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ color: sourceColor, backgroundColor: `${sourceColor}15` }}
            >
              {sourceLabel}
            </span>
            <span className="text-sm font-bold text-slate-800">{cur.title}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {step + 1}/{STEPS.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: sourceColor }}
            >
              Next
            </button>
          </div>
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-1 mt-2">
          {STEPS.map((s, i) => {
            const dotColor = s.source === 'cdn' ? '#10b981' : '#8b5cf6';
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="transition-all duration-200"
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i <= step ? dotColor : '#e2e8f0',
                  opacity: i === step ? 1 : i < step ? 0.5 : 0.3,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Source flow diagram */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-700 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${step <= 1 ? 'animate-pulse' : ''}`} style={{ backgroundColor: '#10b981' }} />
          <span className="text-[9px] font-mono text-emerald-400">CDN Edge</span>
        </div>
        <svg className="w-4 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className="text-[9px] font-mono text-slate-400">Browser</span>
        <svg className="w-4 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
        </svg>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${step >= 2 ? 'animate-pulse' : ''}`} style={{ backgroundColor: step >= 2 ? '#8b5cf6' : '#475569' }} />
          <span className={`text-[9px] font-mono ${step >= 2 ? 'text-violet-400' : 'text-slate-600'}`}>Origin Server</span>
        </div>
      </div>

      {/* Main content: HTML source + Browser preview */}
      <div className="grid grid-cols-[1fr_280px]">
        {/* HTML Source Panel */}
        <div className="border-r border-slate-200">
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 border-b border-slate-200">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sourceColor }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              HTTP Response Body
            </span>
            <span className="text-[8px] font-mono text-slate-400 ml-auto bg-white px-1.5 py-0.5 rounded border border-slate-200">
              Transfer-Encoding: chunked
            </span>
          </div>
          <div
            ref={htmlPanelRef}
            className="bg-[#0f172a] overflow-auto"
            style={{ height: 340 }}
          >
            <pre
              className="p-3"
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                lineHeight: '16px',
                margin: 0,
              }}
            >
              {prevHtml && (
                <span>{renderHtml(prevHtml, '#475569')}</span>
              )}
              {cur.html && (
                <span
                  className="relative"
                  style={{
                    backgroundColor: `${sourceColor}12`,
                    borderLeft: `2px solid ${sourceColor}`,
                    paddingLeft: 4,
                    marginLeft: -6,
                  }}
                >
                  {renderHtml(cur.html, '#e2e8f0')}
                </span>
              )}
              <span
                className="animate-pulse inline-block"
                style={{ color: sourceColor, marginLeft: 2 }}
              >
                |
              </span>
            </pre>
          </div>
        </div>

        {/* Browser Preview Panel */}
        <div>
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 border-b border-slate-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Browser
            </span>
          </div>
          <div style={{ height: 340 }}>
            {/* Browser chrome */}
            <div className="h-6 bg-slate-100 border-b border-slate-200 flex items-center px-2 gap-1">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded h-3.5 mx-1 px-1.5 flex items-center border border-slate-200">
                <span className="text-[7px] text-slate-400 font-mono">bellas-pizza.com/order</span>
              </div>
            </div>

            {/* Page sections */}
            <div className="p-2 space-y-1.5 overflow-auto bg-white" style={{ height: 340 - 24 }}>
              {cur.sections.map((sec) => {
                if (sec.state === 'hidden') return null;

                return (
                  <div
                    key={sec.id}
                    className="rounded-lg border transition-all duration-500"
                    style={{
                      borderColor: sec.state === 'loaded' ? (sec.bgColor || '#e2e8f0') : '#e2e8f0',
                      backgroundColor: sec.state === 'loaded' ? (sec.bgColor || '#f8fafc') : '#f8fafc',
                    }}
                  >
                    {sec.state === 'skeleton' ? (
                      <div className="p-2">
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mb-1">{sec.label}</div>
                        <div className="space-y-1">
                          <div className="h-2 bg-slate-200 rounded-full w-3/4 animate-pulse" />
                          <div className="h-2 bg-slate-200 rounded-full w-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="w-2 h-2 border border-amber-400 border-t-amber-500 rounded-full animate-spin" />
                          <span className="text-[7px] text-amber-500 font-mono">awaiting data...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">{sec.label}</span>
                          {sec.badge && (
                            <span className="text-[6px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-semibold">
                              {sec.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] font-medium text-slate-700">{sec.content}</div>
                        {sec.id !== 'header' && sec.id !== 'specials' && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[7px] font-mono text-emerald-600">$RC swapped</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div className="px-6 py-4 border-t border-slate-200">
        <p className="text-[12px] text-slate-600 leading-relaxed mb-2">{cur.desc}</p>
        <div className="bg-violet-50/80 border-l-[3px] border-violet-400 rounded-r-lg px-4 py-3">
          <p className="text-[11px] text-violet-900/80 leading-relaxed">{cur.detail}</p>
        </div>
      </div>

      {/* Bottom summary */}
      <div className="px-6 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-t border-indigo-100">
        <p className="text-[11px] text-indigo-800 leading-relaxed">
          <strong>The pattern for every $RC chunk:</strong>{' '}
          <code className="text-[10px] bg-indigo-100 px-1 py-0.5 rounded font-mono">&lt;div hidden id=&quot;S:X&quot;&gt;</code>{' '}
          contains the rendered HTML + scoped CSS.{' '}
          <code className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono">$RC(&quot;B:X&quot;,&quot;S:X&quot;)</code>{' '}
          finds the skeleton placeholder and swaps it in — pure DOM manipulation, no React reconciliation needed.
        </p>
      </div>
    </div>
  );
}

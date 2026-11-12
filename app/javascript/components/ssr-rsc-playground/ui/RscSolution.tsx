'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BASE_SECTIONS, LOYALTY_SECTION, NETWORK_PROFILES } from '../defaults';

// ── Metrics (Slow 3G) ───────────────────────────────────────────────────────

const NET = NETWORK_PROFILES.slow3g;
function dl(kb: number): number { return kb / NET.bandwidthKbMs + NET.rttMs; }
function fmt(ms: number): string { return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`; }

const SSR_FW_KB = 85;
const RSC_FW_KB = 45;
const SHELL_CSS_KB = 8;
const SELECTIVE_HYDRATION_MS = 20;

function ssrMetrics(sections: typeof BASE_SECTIONS) {
  const cssKb = sections.reduce((s, sec) => s + sec.cssKb, 0);
  const htmlKb = sections.reduce((s, sec) => s + sec.htmlKb, 0);
  const jsKb = SSR_FW_KB + sections.reduce((s, sec) => s + sec.totalJsKb, 0);
  const cdnEnd = 5;
  const htmlEnd = cdnEnd + dl(htmlKb);
  const cssEnd = cdnEnd + 3 + dl(cssKb);
  const jsEnd = cdnEnd + 3 + dl(jsKb);
  const fcpMs = Math.max(htmlEnd, cssEnd);
  const jsParseEnd = jsEnd + jsKb * 0.5;
  const propsEnd = jsParseEnd + 5;
  const hydStart = Math.max(propsEnd, fcpMs);
  const ttiMs = hydStart + sections.length * 70;
  return { fcpMs, ttiMs, jsKb, cssKb };
}

function rscMetrics(sections: typeof BASE_SECTIONS) {
  const clientJsKb = RSC_FW_KB + sections.reduce((s, sec) => s + sec.clientJsKb, 0);
  const cdnEnd = 5;
  const shellFcp = Math.max(cdnEnd + dl(6), cdnEnd + 3 + dl(SHELL_CSS_KB));
  const jsReady = cdnEnd + 3 + dl(clientJsKb) + clientJsKb * 0.5;
  let cursor = shellFcp;
  let lastInteractive = shellFcp;
  const streaming = sections.filter((s) => s.id !== 'header');
  for (const sec of streaming) {
    const streamStart = cursor + 25;
    const streamEnd = streamStart + dl(sec.htmlKb + 5);
    const visibleAt = streamEnd;
    const hydStart = sec.clientJsKb > 0 ? Math.max(visibleAt, jsReady) : visibleAt;
    const interactive = hydStart + (sec.clientJsKb > 0 ? SELECTIVE_HYDRATION_MS : 0);
    if (interactive > lastInteractive) lastInteractive = interactive;
    cursor = streamEnd;
  }
  return { fcpMs: shellFcp, ttiMs: lastInteractive, jsKb: clientJsKb, cssInHead: SHELL_CSS_KB };
}

const SSR_B = ssrMetrics(BASE_SECTIONS);
const SSR_L = ssrMetrics([...BASE_SECTIONS, LOYALTY_SECTION]);
const RSC_B = rscMetrics(BASE_SECTIONS);
const RSC_L = rscMetrics([...BASE_SECTIONS, LOYALTY_SECTION]);

// ── Code to display ─────────────────────────────────────────────────────────

const CODE = [
  '// page.tsx — React Server Component',               // 0
  'export default async function OrderPage() {',         // 1
  '  return (',                                          // 2
  '    <Layout>',                                          // 3
  '      <Header />',                                    // 4
  '',                                                    // 5
  '      <Suspense fallback={<div>Loading menu...</div>}>',   // 6
  '        <Menu items={await db.menuItems()} />',       // 7
  '      </Suspense>',                                   // 8
  '',                                                    // 9
  '      <Suspense fallback={<div>Loading cart...</div>}>',   // 10
  '        <Cart user={await getUser()} />',             // 11
  '      </Suspense>',                                   // 12
  '',                                                    // 13
  '      <Suspense fallback={<div>Loading reviews...</div>}>', // 14
  '        <Reviews data={await db.reviews()} />',       // 15
  '      </Suspense>',                                   // 16
  '    </Layout>',                                       // 17
  '  );',                                                // 18
  '}',                                                   // 19
];

// ── Syntax highlighting (React elements) ────────────────────────────────────

type Seg = { text: string; color: string };

function tokenizeLine(raw: string): Seg[] {
  if (!raw) return [{ text: ' ', color: '#cbd5e1' }];

  if (raw.trimStart().startsWith('//')) {
    return [{ text: raw, color: '#64748b' }];
  }

  const segs: Seg[] = [];
  let rest = raw;

  while (rest.length > 0) {
    let match: RegExpMatchArray | null;

    if ((match = rest.match(/^(export|default|async|function|return|await)\b/))) {
      segs.push({ text: match[0], color: '#c084fc' });
      rest = rest.slice(match[0].length);
    } else if (/^<\/?(Layout|Suspense|Header|Menu|Cart|Reviews|div)/.test(rest)) {
      const tagMatch = rest.match(/^(<\/?)(Layout|Suspense|Header|Menu|Cart|Reviews|div)/)!;
      segs.push({ text: tagMatch[1], color: '#cbd5e1' });
      segs.push({ text: tagMatch[2], color: '#60a5fa' });
      rest = rest.slice(tagMatch[0].length);
    } else if ((match = rest.match(/^(fallback|items|user|data)(?=\s*=)/))) {
      segs.push({ text: match[0], color: '#67e8f9' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^"[^"]*"/))) {
      segs.push({ text: match[0], color: '#86efac' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^(db\.menuItems|db\.reviews|getUser)/))) {
      segs.push({ text: match[0], color: '#fbbf24' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^(OrderPage)/))) {
      segs.push({ text: match[0], color: '#fbbf24' });
      rest = rest.slice(match[0].length);
    } else {
      const nextSpecial = rest.slice(1).search(/<|"|export|default|async|function|return|await|fallback|items|user|data|db\.|getUser|OrderPage/);
      const len = nextSpecial === -1 ? rest.length : nextSpecial + 1;
      segs.push({ text: rest.slice(0, len), color: '#cbd5e1' });
      rest = rest.slice(len);
    }
  }

  return segs;
}

const CODE_TOKENS: Seg[][] = CODE.map(tokenizeLine);

function renderLine(tokens: Seg[]): React.ReactNode {
  return tokens.map((seg, i) => (
    <span key={i} style={{ color: seg.color }}>{seg.text}</span>
  ));
}

// ── Steps ───────────────────────────────────────────────────────────────────

interface BrowserSection {
  id: string;
  label: string;
  state: 'skeleton' | 'loaded';
  content: string;
  color: string;
}

interface Step {
  lines: number[];
  title: string;
  desc: string;
  html: string;
  sections: BrowserSection[];
  phase?: 'shell' | 'fallback' | 'resolve';
}

const L = (id: string, l: string, c: string, col: string): BrowserSection => ({
  id, label: l, state: 'loaded', content: c, color: col,
});
const S = (id: string, l: string, c: string): BrowserSection => ({
  id, label: l, state: 'skeleton', content: c, color: '#f1f5f9',
});

const SEC_COLORS: Record<string, string> = {
  header: '#e2e8f0',
  menu: '#d1fae5',
  cart: '#dbeafe',
  reviews: '#fae8ff',
};

const STEPS: Step[] = [
  {
    lines: [1, 2, 3],
    title: 'Server starts rendering',
    desc: 'Layout streams the HTML shell with CSS in <head>. The shell is small and prebuilt — it starts painting quickly.',
    html: `<!DOCTYPE html>
<html>
<head>
  <link href="styles.css" />
</head>
<body>`,
    sections: [],
    phase: 'shell',
  },
  {
    lines: [4],
    title: 'Header renders (Server Component)',
    desc: 'Server Component — rendered to HTML on the server. Zero JS sent to browser. Instantly visible.',
    html: `
  <nav class="header">
    Bella's Pizza
  </nav>`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
    ],
    phase: 'shell',
  },
  {
    lines: [6],
    title: 'Menu Suspense — stream fallback',
    desc: 'Hits a Suspense boundary. Streams the skeleton fallback immediately. The server starts fetching data but doesn\'t wait — it moves on to the next boundary.',
    html: `

  <!--$?-->
  <template id="B:0"></template>
  <div class="skeleton">
    Loading menu...
  </div>
  <!--/$-->`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      S('menu', 'Menu', 'Loading menu...'),
    ],
    phase: 'fallback',
  },
  {
    lines: [7],
    title: 'Menu starts data fetch',
    desc: 'await db.menuItems() suspends this boundary. The server moves to the next boundary without waiting for the data.',
    html: `
  <!-- awaiting db.menuItems()... -->`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      S('menu', 'Menu', 'Loading menu...'),
    ],
    phase: 'fallback',
  },
  {
    lines: [10],
    title: 'Cart Suspense — stream fallback',
    desc: 'Streams the cart skeleton fallback. Browser shows the loading state while the server fetches user data.',
    html: `

  <!--$?-->
  <template id="B:1"></template>
  <div class="skeleton">
    Loading cart...
  </div>
  <!--/$-->`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      S('menu', 'Menu', 'Loading menu...'),
      S('cart', 'Cart', 'Loading cart...'),
    ],
    phase: 'fallback',
  },
  {
    lines: [14],
    title: 'Reviews Suspense — stream fallback',
    desc: 'All fallbacks streamed. The browser is showing skeleton UI for all three sections while the server fetches data in parallel.',
    html: `

  <!--$?-->
  <template id="B:2"></template>
  <div class="skeleton">
    Loading reviews...
  </div>
  <!--/$-->`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      S('menu', 'Menu', 'Loading menu...'),
      S('cart', 'Cart', 'Loading cart...'),
      S('reviews', 'Reviews', 'Loading reviews...'),
    ],
    phase: 'fallback',
  },
  {
    lines: [7, 8],
    title: 'Menu data arrives!',
    desc: 'db.menuItems() resolved. Server streams the rendered HTML in a hidden <div>. The $RC inline script swaps the skeleton with the real content — no full-page re-render needed.',
    html: `

  <div hidden id="S:0">
    <div class="menu-grid">
      Margherita | Pepperoni
    </div>
  </div>
  <script>
    $RC('S:0','B:0')
  </script>`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      L('menu', 'Menu Grid', 'Margherita | Pepperoni', SEC_COLORS.menu),
      S('cart', 'Cart', 'Loading cart...'),
      S('reviews', 'Reviews', 'Loading reviews...'),
    ],
    phase: 'resolve',
  },
  {
    lines: [11, 12],
    title: 'Cart data arrives!',
    desc: 'Cart HTML streamed. $RC swaps the skeleton instantly. The Cart client component can now be selectively hydrated — independently of Menu or Reviews.',
    html: `

  <div hidden id="S:1">
    <div class="cart-widget">
      2 items — $24.99
    </div>
  </div>
  <script>
    $RC('S:1','B:1')
  </script>`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      L('menu', 'Menu Grid', 'Margherita | Pepperoni', SEC_COLORS.menu),
      L('cart', 'Cart Widget', '2 items — $24.99', SEC_COLORS.cart),
      S('reviews', 'Reviews', 'Loading reviews...'),
    ],
    phase: 'resolve',
  },
  {
    lines: [15, 16],
    title: 'Reviews data arrives!',
    desc: 'Final boundary resolved. $RC swaps the skeleton. Each boundary streamed and resolved independently — no boundary waited for any other.',
    html: `

  <div hidden id="S:2">
    <div class="reviews-list">
      "Best pizza ever!"
    </div>
  </div>
  <script>
    $RC('S:2','B:2')
  </script>`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      L('menu', 'Menu Grid', 'Margherita | Pepperoni', SEC_COLORS.menu),
      L('cart', 'Cart Widget', '2 items — $24.99', SEC_COLORS.cart),
      L('reviews', 'Reviews', '"Best pizza ever!"', SEC_COLORS.reviews),
    ],
    phase: 'resolve',
  },
  {
    lines: [17, 18, 19],
    title: 'Stream complete',
    desc: 'Page fully loaded. All content is in HTML for SEO. Each client component hydrates independently — zero monolithic hydration blocking the page.',
    html: `

</body>
</html>`,
    sections: [
      L('header', 'Header', "Bella's Pizza", SEC_COLORS.header),
      L('menu', 'Menu Grid', 'Margherita | Pepperoni', SEC_COLORS.menu),
      L('cart', 'Cart Widget', '2 items — $24.99', SEC_COLORS.cart),
      L('reviews', 'Reviews', '"Best pizza ever!"', SEC_COLORS.reviews),
    ],
    phase: 'resolve',
  },
];

// ── HTML highlighting (React elements) ──────────────────────────────────────

function tokenizeHtml(raw: string): Seg[] {
  const segs: Seg[] = [];
  let rest = raw;

  while (rest.length > 0) {
    let match: RegExpMatchArray | null;

    if ((match = rest.match(/^<!--.*?-->/))) {
      segs.push({ text: match[0], color: '#64748b' });
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
    } else if ((match = rest.match(/^'[^']*'/))) {
      segs.push({ text: match[0], color: '#86efac' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^\$RC/))) {
      segs.push({ text: match[0], color: '#fbbf24' });
      rest = rest.slice(match[0].length);
    } else {
      const nextSpecial = rest.slice(1).search(/<|\/?>/);
      const len = nextSpecial === -1 ? rest.length : nextSpecial + 1;
      segs.push({ text: rest.slice(0, len), color: '#cbd5e1' });
      rest = rest.slice(len);
    }
  }

  return segs;
}

function renderHtmlTokens(raw: string, baseColor: string): React.ReactNode {
  const tokens = tokenizeHtml(raw);
  return tokens.map((seg, i) => (
    <span key={i} style={{ color: seg.color === '#cbd5e1' ? baseColor : seg.color }}>{seg.text}</span>
  ));
}

// ── Component ───────────────────────────────────────────────────────────────

export default function RscSolution() {
  const [step, setStep] = useState(0);
  const [flyVisible, setFlyVisible] = useState(false);
  const [flyKey, setFlyKey] = useState(0);
  const htmlPanelRef = useRef<HTMLDivElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(0);

  const cur = STEPS[step];
  const highlightSet = new Set(cur.lines);

  const prevHtml = STEPS.slice(0, step)
    .map((s) => s.html)
    .join('');

  useEffect(() => {
    if (step !== prevStepRef.current && cur.html) {
      setFlyVisible(true);
      setFlyKey((k) => k + 1);
      const timer = setTimeout(() => setFlyVisible(false), 700);
      prevStepRef.current = step;
      return () => clearTimeout(timer);
    }
    prevStepRef.current = step;
  }, [step, cur.html]);

  useEffect(() => {
    if (htmlPanelRef.current) {
      htmlPanelRef.current.scrollTop = htmlPanelRef.current.scrollHeight;
    }
  }, [step]);

  useEffect(() => {
    if (codePanelRef.current) {
      const el = codePanelRef.current.querySelector('[data-hl="true"]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [step]);

  const phaseColor =
    cur.phase === 'shell' ? '#10b981' :
    cur.phase === 'fallback' ? '#f59e0b' :
    '#6366f1';

  const phaseLabel =
    cur.phase === 'shell' ? 'Shell' :
    cur.phase === 'fallback' ? 'Streaming Fallbacks' :
    'Data Resolving';

  const flyPreview = cur.html
    ? cur.html.trim().split('\n').slice(0, 2).join(' ').slice(0, 60)
    : '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Keyframes for flying animation */}
      <style>{`
        @keyframes flyChunk {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          60% { opacity: 0.9; transform: translateY(40px) scale(0.95); }
          100% { opacity: 0; transform: translateY(70px) scale(0.85); }
        }
      `}</style>

      {/* Header */}
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            How RSC Streaming Works
          </h2>
        </div>
        <p className="text-sm text-slate-500 max-w-2xl">
          An RSC page is divided into <strong className="text-violet-700">Suspense boundaries</strong>.
          Each boundary streams its own HTML independently. Client components hydrate selectively —
          no monolithic hydration pass. Watch the server execute line by line and stream content to the browser.
        </p>
      </div>

      {/* ── Step info + navigation (above panels) ──────────────────────── */}
      <div className="px-4 pb-3">
        <div
          className="rounded-xl p-3 transition-colors duration-300"
          style={{
            backgroundColor: `${phaseColor}08`,
            borderLeft: `4px solid ${phaseColor}`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: phaseColor, backgroundColor: `${phaseColor}15` }}
              >
                {phaseLabel}
              </span>
              <div>
                <span className="text-[13px] font-bold text-slate-800">{cur.title}</span>
                <span className="text-[10px] text-slate-400 font-mono ml-2">
                  {step + 1}/{STEPS.length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors"
                style={{
                  backgroundColor: step === STEPS.length - 1 ? '#94a3b8' : phaseColor,
                  cursor: step === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: step === STEPS.length - 1 ? 0.4 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed mt-1">
            {cur.desc}
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1 mt-2">
            {STEPS.map((s, i) => {
              const dotColor =
                s.phase === 'shell' ? '#10b981' :
                s.phase === 'fallback' ? '#f59e0b' :
                '#6366f1';
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
      </div>

      {/* ── Server Code (full width) ───────────────────────────────────── */}
      <div className="px-4 pb-0 relative">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Server Code
          </span>
          <span className="text-[8px] font-mono text-slate-400 ml-auto bg-slate-100 px-1.5 py-0.5 rounded">
            page.tsx
          </span>
        </div>
        <div
          ref={codePanelRef}
          className="bg-[#0f172a] rounded-lg overflow-auto border border-slate-700/50"
          style={{ maxHeight: 340 }}
        >
          <div className="py-2">
            {CODE.map((line, i) => {
              const isHl = highlightSet.has(i);
              return (
                <div
                  key={i}
                  data-hl={isHl ? 'true' : undefined}
                  className="flex items-center transition-colors duration-300"
                  style={{
                    backgroundColor: isHl ? `${phaseColor}18` : 'transparent',
                    borderLeft: isHl ? `3px solid ${phaseColor}` : '3px solid transparent',
                    minHeight: line === '' ? 16 : undefined,
                  }}
                >
                  <span
                    className="w-7 text-right pr-2 select-none flex-shrink-0"
                    style={{
                      fontSize: 9,
                      color: isHl ? phaseColor : '#475569',
                      fontFamily: 'monospace',
                    }}
                  >
                    {i + 1}
                  </span>

                  {isHl && (
                    <span
                      className="mr-1 flex-shrink-0 animate-pulse"
                      style={{ color: phaseColor, fontSize: 8 }}
                    >
                      ▶
                    </span>
                  )}

                  <span
                    className="flex-1"
                    style={{
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                      color: '#cbd5e1',
                      whiteSpace: 'pre',
                      lineHeight: '18px',
                    }}
                  >
                    {renderLine(CODE_TOKENS[i])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Flying chunk animation ─────────────────────────────────────── */}
      <div className="relative h-8 flex items-center justify-center overflow-visible">
        {/* Down arrow */}
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>

        {/* Flying chunk */}
        {flyVisible && flyPreview && (
          <div
            key={flyKey}
            className="absolute left-1/2 pointer-events-none z-10"
            style={{
              animation: 'flyChunk 700ms ease-in-out forwards',
              transform: 'translateX(-50%)',
              top: -8,
            }}
          >
            <div
              className="rounded px-3 py-1 shadow-lg border whitespace-nowrap"
              style={{
                backgroundColor: '#1e293b',
                borderColor: `${phaseColor}60`,
                boxShadow: `0 4px 20px ${phaseColor}30`,
                fontSize: 9,
                fontFamily: "'JetBrains Mono', Menlo, monospace",
                color: phaseColor,
              }}
            >
              {flyPreview}
              {flyPreview.length >= 60 && '...'}
            </div>
          </div>
        )}
      </div>

      {/* ── HTML Source + Browser Preview (side by side) ────────────────── */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-[1fr_300px] gap-3">
          {/* HTML Source */}
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Page Source HTML
              </span>
              <span className="text-[8px] font-mono text-slate-400 ml-auto bg-slate-100 px-1.5 py-0.5 rounded">
                Transfer-Encoding: chunked
              </span>
            </div>
            <div
              ref={htmlPanelRef}
              className="bg-[#0f172a] rounded-lg overflow-auto border border-slate-700/50"
              style={{ height: 300 }}
            >
              <pre className="p-3" style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                lineHeight: '16px',
                margin: 0,
              }}>
                {prevHtml && (
                  <span style={{ color: '#475569' }}>
                    {renderHtmlTokens(prevHtml, '#475569')}
                  </span>
                )}
                {cur.html && (
                  <span
                    className="relative"
                    style={{
                      color: '#e2e8f0',
                      backgroundColor: `${phaseColor}12`,
                      borderLeft: `2px solid ${phaseColor}`,
                      paddingLeft: 4,
                      marginLeft: -6,
                    }}
                  >
                    {renderHtmlTokens(cur.html, '#e2e8f0')}
                  </span>
                )}
                <span
                  className="animate-pulse inline-block"
                  style={{ color: phaseColor, marginLeft: 2 }}
                >
                  |
                </span>
              </pre>
            </div>
          </div>

          {/* Browser Preview */}
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Rendered Page
              </span>
            </div>
            <div className="rounded-lg border border-slate-300 overflow-hidden bg-white" style={{ height: 300 }}>
              {/* Browser chrome */}
              <div className="h-7 bg-slate-100 border-b border-slate-200 flex items-center px-2 gap-1.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded h-4 mx-1.5 px-2 flex items-center border border-slate-200">
                  <span className="text-[8px] text-slate-400 font-mono truncate">
                    bellas-pizza.com/order
                  </span>
                </div>
              </div>

              {/* Page content */}
              <div className="p-2.5 space-y-2 overflow-auto" style={{ height: 300 - 28 }}>
                {cur.sections.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                      <span className="text-[10px] text-slate-400">Receiving HTML...</span>
                    </div>
                  </div>
                )}
                {cur.sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="rounded-lg border transition-all duration-500"
                    style={{
                      borderColor: sec.state === 'skeleton' ? '#e2e8f0' : sec.color,
                      backgroundColor: sec.state === 'skeleton' ? '#f8fafc' : sec.color,
                    }}
                  >
                    {sec.state === 'skeleton' ? (
                      <div className="p-2.5">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          {sec.label}
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2 bg-slate-200 rounded-full w-3/4 animate-pulse" />
                          <div className="h-2 bg-slate-200 rounded-full w-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
                        </div>
                        <div className="mt-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 border border-amber-400 border-t-amber-500 rounded-full animate-spin" />
                            <span className="text-[7px] text-amber-500 font-mono">awaiting data...</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5">
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                          {sec.label}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">
                          {sec.content}
                        </div>
                        {sec.id !== 'header' && (
                          <div className="mt-1 flex items-center gap-1">
                            <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[7px] font-mono text-emerald-600">
                              streamed via $RC
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why RSC is faster — even without adding sections ──────────── */}
      <div className="px-6 py-5 border-t border-slate-200">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Why migrating from cached SSR to cached RSC makes the app faster
        </div>
        <p className="text-[12px] text-slate-500 mb-4">
          Even without adding any new sections — just migrating the same 6-section page from SSR to RSC
          on Slow 3G produces dramatic improvements.
        </p>

        {/* Migration metric cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <MetricCard
            label="First Contentful Paint"
            ssrVal={fmt(SSR_B.fcpMs)}
            rscVal={fmt(RSC_B.fcpMs)}
            reason={`SSR sends the full HTML document before paint. RSC streams a tiny shell first — content appears almost instantly, then streams in progressively.`}
          />
          <MetricCard
            label="Time to Interactive"
            ssrVal={fmt(SSR_B.ttiMs)}
            rscVal={fmt(RSC_B.ttiMs)}
            reason="SSR hydrates everything in one blocking pass. RSC hydrates each island independently (~20ms each)."
          />
          <MetricCard
            label="JS to Browser"
            ssrVal={`${SSR_B.jsKb} KB`}
            rscVal={`${Math.round(RSC_B.jsKb)} KB`}
            reason="SSR ships all component JS. RSC only ships client island JS — server component code stays on the server."
          />
          <MetricCard
            label="Server Components"
            ssrVal="0%"
            rscVal={`${Math.round((1 - RSC_B.jsKb / SSR_B.jsKb) * 100)}%`}
            reason="RSC renders Server Components to HTML on the server — zero JS shipped. SSR ships JS for every component."
          />
        </div>

        {/* Advantages list */}
        <div className="space-y-3">
          <Advantage
            icon={<StreamIcon />}
            title="Content streams progressively via Suspense"
            desc="Each Suspense boundary resolves independently on the server. As data arrives, $RC swaps the skeleton with real HTML — the user sees content progressively instead of waiting for ALL data before seeing ANY content."
            tag="Streaming"
            tagColor="#8b5cf6"
          />
          <Advantage
            icon={<HydrationIcon />}
            title="Client components hydrate independently"
            desc={`Each client island (Add to Cart, Location Picker, Carousel) downloads its own JS chunk and hydrates in ~${SELECTIVE_HYDRATION_MS}ms — independently of other islands. SSR blocks the entire page for ${Math.round(BASE_SECTIONS.length * 70)}ms of monolithic hydration. React even prioritizes the island the user interacts with first.`}
            tag="Selective Hydration"
            tagColor="#6366f1"
          />
          <Advantage
            icon={<StreamIcon />}
            title="Server components send zero JS"
            desc={`Header, Reviews layout, Delivery Info layout — these are Server Components. They render to HTML on the server and send zero JavaScript to the browser. In SSR, every component ships its full JS (${SSR_B.jsKb} KB total). In RSC, only client islands ship JS (${Math.round(RSC_B.jsKb)} KB total — ${Math.round((1 - RSC_B.jsKb / SSR_B.jsKb) * 100)}% smaller).`}
            tag="Zero JS"
            tagColor="#10b981"
          />
          <Advantage
            icon={<SeoIcon />}
            title="Content is in HTML — not lazy-loaded"
            desc="Unlike lazy loading (which renders client-side and risks SEO indexing issues), RSC streams all content as server-rendered HTML. Search engines see every section. Users see content as it streams in, not after TTI + chunk download + data fetch."
            tag="SEO Safe"
            tagColor="#f59e0b"
          />
        </div>
      </div>

      {/* ── Adding sections: zero cascade ─────────────────────────────── */}
      <div className="px-6 py-5 border-t border-slate-200">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Adding a new section — SSR cascade vs RSC isolation
        </div>
        <p className="text-[12px] text-slate-500 mb-4">
          Adding &ldquo;Loyalty Rewards&rdquo; to the page. In SSR, every existing section gets slower.
          In RSC, existing sections are completely unaffected.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* SSR cascade */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <div className="text-[12px] font-bold text-red-700 mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">!</span>
              SSR — Everything gets slower
            </div>
            <div className="space-y-2">
              <CascadeRow label="FCP" delta={`+${fmt(SSR_L.fcpMs - SSR_B.fcpMs)}`} reason="Larger HTML document — takes longer to download before first paint" />
              <CascadeRow label="TTI" delta={`+${fmt(SSR_L.ttiMs - SSR_B.ttiMs)}`} reason="+1 component in monolithic hydration pass" />
              <CascadeRow label="JS Bundle" delta={`+${LOYALTY_SECTION.totalJsKb} KB`} reason="Full component JS added to bundle" />
              <CascadeRow label="Every section" delta="Slower" reason="Header, Menu, Cart, Reviews — all delayed by bigger bundle and longer hydration" />
            </div>
          </div>

          {/* RSC isolation */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="text-[12px] font-bold text-emerald-700 mb-3 flex items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              RSC — Only the new section costs
            </div>
            <div className="space-y-2">
              <IsolationRow label="FCP" value="+0ms" reason={`Shell is prebuilt and cached — paint timing identical`} />
              <IsolationRow label="TTI" value={`+${fmt(RSC_L.ttiMs - RSC_B.ttiMs)}`} reason="Only the new boundary's stream + hydration" />
              <IsolationRow label="JS Bundle" value={`+${LOYALTY_SECTION.clientJsKb} KB`} reason="Only the client island JS — server code stays on server" />
              <IsolationRow label="Every section" value="Unchanged" reason="Header, Menu, Cart, Reviews — exact same load speed" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom summary ────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-100">
        <p className="text-[13px] text-emerald-900 leading-relaxed">
          <strong>RSC eliminates the SSR scaling problem.</strong> Each section is an isolated
          streaming unit with its own HTML and independent hydration.
          Adding content never degrades existing sections. And even without changing the page,
          migrating from SSR to RSC cuts FCP by{' '}
          <strong className="text-emerald-700">
            {Math.round((1 - RSC_B.fcpMs / SSR_B.fcpMs) * 100)}%
          </strong>
          {' '}and JS bundle by{' '}
          <strong className="text-emerald-700">
            {Math.round((1 - RSC_B.jsKb / SSR_B.jsKb) * 100)}%
          </strong>
          .
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, ssrVal, rscVal, reason }: {
  label: string; ssrVal: string; rscVal: string; reason: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="flex items-end gap-2 mb-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-red-400 line-through">{ssrVal}</span>
          <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-[14px] font-bold text-emerald-600">{rscVal}</span>
        </div>
      </div>
      <div className="text-[9px] text-slate-400 leading-snug">{reason}</div>
    </div>
  );
}

function Advantage({ icon, title, desc, tag, tagColor }: {
  icon: React.ReactNode; title: string; desc: string; tag: string; tagColor: string;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tagColor}15` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[12px] font-bold text-slate-800">{title}</span>
          <span
            className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: tagColor, backgroundColor: `${tagColor}12` }}
          >
            {tag}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function CascadeRow({ label, delta, reason }: { label: string; delta: string; reason: string }) {
  return (
    <div className="flex items-start gap-2">
      <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-slate-500">{label}:</span>
          <span className="text-[12px] font-bold text-red-600">{delta}</span>
        </div>
        <div className="text-[9px] text-slate-400">{reason}</div>
      </div>
    </div>
  );
}

function IsolationRow({ label, value, reason }: { label: string; value: string; reason: string }) {
  return (
    <div className="flex items-start gap-2">
      <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-slate-500">{label}:</span>
          <span className="text-[12px] font-bold text-emerald-600">{value}</span>
        </div>
        <div className="text-[9px] text-slate-400">{reason}</div>
      </div>
    </div>
  );
}

function CssIcon() {
  return (
    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function HydrationIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function StreamIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12l4-4m-4 4l4 4" />
    </svg>
  );
}

function SeoIcon() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

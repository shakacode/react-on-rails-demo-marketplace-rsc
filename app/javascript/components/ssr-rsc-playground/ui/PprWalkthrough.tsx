'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Bandwidth simulation ─────────────────────────────────────────────────────

interface ResourceDef {
  name: string;
  sizeKb: number;
  label: string;
  color: string;
  discoverEff: number;
}

interface BwSegment {
  startEff: number;
  endEff: number;
  startKb: number;
  endKb: number;
}

interface SimResource extends ResourceDef {
  endEff: number;
  segments: BwSegment[];
}

function simulateBandwidth(defs: ResourceDef[], totalBw: number): SimResource[] {
  const state = defs.map((d) => ({
    ...d,
    remaining: d.sizeKb,
    downloaded: 0,
    done: false,
    endEff: 0,
    segments: [] as BwSegment[],
  }));

  let t = 0;
  while (state.some((s) => !s.done) && t < 100000) {
    const active = state.filter((s) => t >= s.discoverEff && !s.done);
    if (active.length === 0) {
      const next = state.filter((s) => !s.done).sort((a, b) => a.discoverEff - b.discoverEff)[0];
      if (!next) break;
      t = next.discoverEff;
      continue;
    }
    const bwEach = totalBw / active.length;
    let dt = Infinity;
    for (const r of active) dt = Math.min(dt, r.remaining / bwEach);
    const pending = state.filter((s) => !s.done && s.discoverEff > t).sort((a, b) => a.discoverEff - b.discoverEff);
    if (pending.length > 0 && pending[0].discoverEff - t < dt) dt = pending[0].discoverEff - t;

    for (const r of active) {
      const kb = bwEach * dt;
      r.segments.push({ startEff: t, endEff: t + dt, startKb: r.downloaded, endKb: r.downloaded + kb });
      r.downloaded += kb;
      r.remaining -= kb;
      if (r.remaining < 0.01) {
        r.done = true;
        r.endEff = t + dt;
        r.remaining = 0;
      }
    }
    t += dt;
  }
  return state;
}

function getProgress(res: SimResource, effMs: number): number {
  if (effMs <= res.discoverEff) return 0;
  if (effMs >= res.endEff) return 1;
  for (const seg of res.segments) {
    if (effMs <= seg.endEff) {
      const frac = (effMs - seg.startEff) / (seg.endEff - seg.startEff);
      return (seg.startKb + (seg.endKb - seg.startKb) * frac) / res.sizeKb;
    }
  }
  return 1;
}

// ── PPR resource definitions ─────────────────────────────────────────────────
// PPR serves a pre-rendered static shell from CDN (very small — just HTML with
// skeleton fallbacks + CSS). In parallel, CDN connects to origin
// server which resumes SSR for dynamic Suspense boundaries.

const CDN_LATENCY = 30; // Edge response starts in ~30ms (no origin needed)
const ORIGIN_CONNECT = 50; // CDN→Origin connection in parallel

// Browser downloads from CDN — all <script> and <link> tags are in the shell's <head>,
// so the browser discovers CSS and JS immediately as the first bytes of HTML stream in.
// JS is a single route-level chunk (automatic code splitting by route in Next.js/RSC).
// Hydration doesn't wait for full page — each Suspense boundary hydrates independently
// as soon as its HTML is swapped into the DOM via $RC AND the JS bundle is loaded.
const BROWSER_DEFS: ResourceDef[] = [
  { name: 'static-shell.html', sizeKb: 12, label: '12 KB', color: '#10b981', discoverEff: CDN_LATENCY },
  { name: 'styles.css', sizeKb: 8, label: '8 KB', color: '#a855f7', discoverEff: CDN_LATENCY + 5 },
  { name: 'route-bundle.js', sizeKb: 103, label: '103 KB', color: '#f59e0b', discoverEff: CDN_LATENCY + 5 },
];

// Origin server processes dynamic boundaries (in parallel with browser downloads).
// Each boundary's discoverEff models the DATA FETCH time before rendering can start:
//   Cart/Delivery: fast — user session is cached, delivery zones are static
//   Menu: medium — DB query with JOINs for menu items, prices, availability
//   Reviews: slow — external review aggregation API with cold start
//   Recommendations: very slow — ML recommendation engine computes personalized results
const ORIGIN_DEFS: ResourceDef[] = [
  { name: 'cart: data + render', sizeKb: 6, label: '6 KB', color: '#6366f1', discoverEff: ORIGIN_CONNECT + 30 },
  { name: 'delivery: data + render', sizeKb: 8, label: '8 KB', color: '#8b5cf6', discoverEff: ORIGIN_CONNECT + 30 },
  { name: 'menu: data + render', sizeKb: 50, label: '50 KB', color: '#3b82f6', discoverEff: ORIGIN_CONNECT + 200 },
  { name: 'reviews: data + render', sizeKb: 30, label: '30 KB', color: '#ec4899', discoverEff: ORIGIN_CONNECT + 500 },
  { name: 'recommendations', sizeKb: 20, label: '20 KB', color: '#14b8a6', discoverEff: ORIGIN_CONNECT + 1000 },
];

const BW_BROWSER = 0.12;
const BW_ORIGIN = 0.25; // Origin→CDN is faster (server-to-server)

const BROWSER_SIM = simulateBandwidth(BROWSER_DEFS, BW_BROWSER);
const ORIGIN_SIM = simulateBandwidth(ORIGIN_DEFS, BW_ORIGIN);

const BROWSER_MAX_END = Math.max(...BROWSER_SIM.map((s) => s.endEff));
const ORIGIN_MAX_END = Math.max(...ORIGIN_SIM.map((s) => s.endEff));

const SHELL_HTML_RES = BROWSER_SIM.find((r) => r.name === 'static-shell.html')!;
const SHELL_CSS_RES = BROWSER_SIM.find((r) => r.name === 'styles.css')!;
const JS_RES = BROWSER_SIM.find((r) => r.name === 'route-bundle.js')!;

const SHELL_FCP = Math.ceil(Math.max(SHELL_HTML_RES.endEff, SHELL_CSS_RES.endEff));
// JS ready = download complete + parse/compile time
const JS_READY = Math.ceil(JS_RES.endEff) + 50; // +50ms parse time for 103 KB

// Dynamic chunks arrive from origin and stream into the browser response
const MENU_RES = ORIGIN_SIM.find((r) => r.name.startsWith('menu'))!;
const CART_RES = ORIGIN_SIM.find((r) => r.name.startsWith('cart'))!;
const DELIVERY_RES = ORIGIN_SIM.find((r) => r.name.startsWith('delivery'))!;
const REVIEWS_RES = ORIGIN_SIM.find((r) => r.name.startsWith('reviews'))!;
const RECS_RES = ORIGIN_SIM.find((r) => r.name.startsWith('recommendation'))!;

// A dynamic boundary becomes visible when BOTH conditions are met:
//   1. Its HTML chunk arrived from origin (swapped into DOM by $RC inline script)
//   2. The shell is painted (CSS loaded — blocks paint just like SSR)
// CSS blocks rendering of the static shell just like SSR does. The advantage is that
// the shell is small, so paint happens fast. Once painted, streamed content appears
// immediately as each $RC script swaps the skeleton.
function dynVisible(originRes: SimResource): number {
  return Math.max(originRes.endEff + CDN_LATENCY, SHELL_FCP);
}

const CART_VISIBLE = dynVisible(CART_RES);
const DELIVERY_VISIBLE = dynVisible(DELIVERY_RES);
const MENU_VISIBLE = dynVisible(MENU_RES);
const REVIEWS_VISIBLE = dynVisible(REVIEWS_RES);
const RECS_VISIBLE = dynVisible(RECS_RES);

// Selective hydration: hydrateRoot() is called ONCE when JS loads.
// React walks the fiber tree and hydrates each Suspense boundary independently.
// Boundaries hydrate in DOM TREE ORDER (not arrival order) during idle time.
// Each boundary takes ~50ms to hydrate (reconcile event handlers, attach listeners).
// If a user clicks a dehydrated boundary, React SYNCHRONOUSLY hydrates it
// in the capture phase of the click event — the click still fires normally.
//
// Boundaries whose HTML hasn't arrived yet (still skeleton) are SKIPPED.
// When their HTML arrives later via $RC, React's scheduleHydration queues them.
const HYDRATION_PER_BOUNDARY = 50;

// Tree order in our page: Menu(1), Cart(2), Delivery(3), Reviews(skip), Recs(4)
function boundaryInteractive(visible: number, isServerComponent: boolean, hydrationSlot: number): number {
  if (isServerComponent) return visible;
  const hydrationStart = Math.max(visible, JS_READY);
  return hydrationStart + HYDRATION_PER_BOUNDARY * hydrationSlot;
}

const MENU_INTERACTIVE = boundaryInteractive(MENU_VISIBLE, false, 1);
const CART_INTERACTIVE = boundaryInteractive(CART_VISIBLE, false, 2);
const DELIVERY_INTERACTIVE = boundaryInteractive(DELIVERY_VISIBLE, false, 3);
const REVIEWS_INTERACTIVE = boundaryInteractive(REVIEWS_VISIBLE, true, 0); // server component
const RECS_INTERACTIVE = boundaryInteractive(RECS_VISIBLE, false, 1); // hydrates after arrival, JS already loaded

const TTI_EFF = Math.max(MENU_INTERACTIVE, CART_INTERACTIVE, DELIVERY_INTERACTIVE, REVIEWS_INTERACTIVE, RECS_INTERACTIVE);
const TRANS = 100;
const TOTAL_EFF = TTI_EFF + TRANS;

// ── Section visibility logic ─────────────────────────────────────────────────

interface SectionState {
  header: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
  menu: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
  cart: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
  delivery: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
  reviews: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
  recommendations: 'hidden' | 'skeleton' | 'loaded' | 'interactive';
}

function getSectionStates(effMs: number): SectionState {
  const shellPainted = effMs >= SHELL_FCP;
  return {
    header: shellPainted ? (effMs >= SHELL_FCP + 10 ? 'interactive' : 'loaded') : effMs > CDN_LATENCY + 50 ? 'skeleton' : 'hidden',
    menu: effMs >= MENU_INTERACTIVE ? 'interactive' : effMs >= MENU_VISIBLE ? 'loaded' : shellPainted ? 'skeleton' : 'hidden',
    cart: effMs >= CART_INTERACTIVE ? 'interactive' : effMs >= CART_VISIBLE ? 'loaded' : shellPainted ? 'skeleton' : 'hidden',
    delivery: effMs >= DELIVERY_INTERACTIVE ? 'interactive' : effMs >= DELIVERY_VISIBLE ? 'loaded' : shellPainted ? 'skeleton' : 'hidden',
    reviews: effMs >= REVIEWS_INTERACTIVE ? 'interactive' : effMs >= REVIEWS_VISIBLE ? 'loaded' : shellPainted ? 'skeleton' : 'hidden',
    recommendations: effMs >= RECS_INTERACTIVE ? 'interactive' : effMs >= RECS_VISIBLE ? 'loaded' : shellPainted ? 'skeleton' : 'hidden',
  };
}

// ── Step definitions ─────────────────────────────────────────────────────────

interface StepNote {
  title: string;
  body: string;
  insight: string;
}

interface Step {
  id: string;
  label: string;
  effEnd: number;
  marker?: string;
  markerColor?: string;
  note: StepNote;
}

const STEPS: Step[] = [
  {
    id: 'request',
    label: 'Page Requested',
    effEnd: CDN_LATENCY,
    note: {
      title: 'Single HTTP Response from Two Sources',
      body: 'The browser requests bellas-pizza.com/order. The CDN edge has the pre-built static shell cached — it starts streaming the shell immediately (~30ms). Simultaneously, the CDN opens a connection to the origin server, sending the "postponed" state so it can resume() rendering the dynamic Suspense boundaries.',
      insight:
        'The browser receives ONE HTTP response (chunked transfer encoding). The CDN streams the cached shell first, then concatenates the origin\'s dynamic chunks onto the same response stream as each boundary resolves. No second request needed.',
    },
  },
  {
    id: 'shell-downloading',
    label: 'Shell + JS + Origin in Parallel',
    effEnd: Math.round(SHELL_FCP * 0.6),
    note: {
      title: 'Three Parallel Workstreams',
      body: 'The browser parses the shell\'s <head> and discovers <link href="styles.css"> and <script src="route-bundle.js"> (103 KB). CSS blocks paint (same as SSR), but the shell is small so it\'s fast. The shell\'s <body> contains Suspense boundary placeholders: <!--$?--><template id="B:0"></template><div class="skeleton">...</div><!--/$--> for each dynamic section.',
      insight:
        'CSS still blocks paint like SSR — but the shell is tiny so paint happens fast. JS downloads in the background — it does NOT block paint or content display. Meanwhile, the origin server is already fetching menu data, cart state, and reviews in parallel.',
    },
  },
  {
    id: 'shell-fcp',
    label: 'FCP — Cart & Delivery Already Visible!',
    effEnd: SHELL_FCP + TRANS,
    marker: 'FCP',
    markerColor: '#10b981',
    note: {
      title: 'First Paint with Content — Not Just Skeletons',
      body: `Shell paints at ${SHELL_FCP}ms. But look: Cart and Delivery already show REAL CONTENT, not skeletons! Their origin chunks arrived at ~${Math.round(CART_VISIBLE)}ms — before FCP. The $RC inline script already swapped their skeletons with real HTML. Meanwhile, Menu, Reviews, and Recommendations are still skeleton placeholders (the origin is still fetching their data).`,
      insight:
        'This is the PPR breakthrough: at FCP, you see a MIX of real content and skeletons. Boundaries that resolved fast on the server (Cart: user session cache, Delivery: cached zones) appear immediately. Slow boundaries (Menu: DB query, Reviews: external API) show skeletons. The page is ALREADY useful — not an empty shell.',
    },
  },
  {
    id: 'menu-streams',
    label: 'Menu Streams In',
    effEnd: MENU_VISIBLE + TRANS,
    note: {
      title: '$RC Swaps Skeleton → Real Content',
      body: `The Menu section (50 KB) finishes rendering on the origin at ~${Math.round(MENU_RES.endEff)}ms. Its HTML chunk streams to the browser as: <div hidden id="S:2">...menu items...</div> <script>$RC("B:2","S:2")</script>. The $RC function finds the <template id="B:2"> placeholder, removes the skeleton fallback, and inserts the real menu HTML. No React reconciliation — pure DOM manipulation.`,
      insight:
        'Content display requires ZERO JavaScript bundle. The $RC function is a tiny (~500 byte) inline script baked into React\'s streaming runtime. The 103 KB route-bundle.js is still downloading — it\'s only needed later for making buttons clickable (hydration). Users can already read and scroll the menu.',
    },
  },
  {
    id: 'reviews-stream',
    label: 'Reviews — Server Component',
    effEnd: REVIEWS_VISIBLE + TRANS,
    note: {
      title: 'Server Component = Instantly Interactive',
      body: `Reviews arrives from the external review API at ~${Math.round(REVIEWS_VISIBLE)}ms. It's a React Server Component — it has NO client-side JavaScript. The $RC script swaps the skeleton, and Reviews is immediately interactive (scrollable, "See all" link works). No hydration needed.`,
      insight:
        `Three states coexist right now: Header and Reviews are INTERACTIVE (green). Cart, Delivery, and Menu show CONTENT but aren't interactive yet — buttons don't respond (JS still loading, ~${Math.round(JS_READY - REVIEWS_VISIBLE)}ms away). Recommendations is still a SKELETON — the ML engine hasn't finished computing. This is selective rendering in action.`,
    },
  },
  {
    id: 'js-hydration',
    label: 'JS Loaded → Selective Hydration',
    effEnd: Math.round((MENU_INTERACTIVE + CART_INTERACTIVE) / 2),
    note: {
      title: 'hydrateRoot() — Boundaries Hydrate in Tree Order',
      body: `route-bundle.js (103 KB) finishes downloading at ~${JS_READY}ms. React calls hydrateRoot() ONCE — it walks the fiber tree and hydrates each Suspense boundary whose HTML is already in the DOM. Tree order: Menu hydrates first (~${Math.round(MENU_INTERACTIVE)}ms), then Cart (~${Math.round(CART_INTERACTIVE)}ms), then Delivery. Each takes ~50ms.`,
      insight:
        'Recommendations is STILL a skeleton! The ML recommendation engine hasn\'t finished on the origin. React skips dehydrated boundaries and moves on. When Recs HTML arrives later, React\'s scheduleHydration will queue it. If a user clicks an unhydrated button, React synchronously hydrates that boundary in the capture phase — the click still fires.',
    },
  },
  {
    id: 'recs-arrive',
    label: 'Last Boundary — Recs Arrive & Hydrate',
    effEnd: RECS_INTERACTIVE + TRANS / 2,
    note: {
      title: 'Slow Boundary Doesn\'t Block Anything',
      body: `The ML recommendation engine finally responds at ~${Math.round(RECS_VISIBLE)}ms. Recs HTML streams in via $RC — the skeleton is replaced with personalized suggestions. Since the JS bundle is already loaded, React immediately hydrates this boundary (~50ms). Everything else has been interactive for hundreds of milliseconds.`,
      insight:
        'This boundary took ${Math.round(RECS_VISIBLE)}ms on the server — but it didn\'t slow down anything else. Cart was interactive at ${Math.round(CART_INTERACTIVE)}ms. Menu at ${Math.round(MENU_INTERACTIVE)}ms. In cached SSR, this slow API call would delay the ENTIRE page. In PPR, it only delays itself.',
    },
  },
  {
    id: 'interactive',
    label: 'Fully Interactive',
    effEnd: TTI_EFF + TRANS,
    marker: 'TTI',
    markerColor: '#6366f1',
    note: {
      title: 'Every Boundary Works',
      body: `All 6 sections are interactive at ${Math.round(TTI_EFF)}ms. But the page was USEFUL long before: Cart was clickable at ${Math.round(CART_INTERACTIVE)}ms, content was readable at ${Math.round(SHELL_FCP)}ms. The user never saw a blank screen or waited for a monolithic hydration pass.`,
      insight:
        'PPR stacks: CDN-speed FCP (' + SHELL_FCP + 'ms) → streaming content via $RC → server components (zero JS) → selective hydration (tree order, ~50ms each) → priority override on click. Adding a new Suspense boundary costs only that boundary\'s server render time. Nothing else gets slower.',
    },
  },
];

// ── Animation helpers ────────────────────────────────────────────────────────

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Code block for PPR introduction ──────────────────────────────────────────

type Seg = { text: string; color: string };

function tokenizeCode(raw: string): Seg[] {
  if (!raw) return [{ text: ' ', color: '#cbd5e1' }];
  if (raw.trimStart().startsWith('//')) return [{ text: raw, color: '#64748b' }];

  const segs: Seg[] = [];
  let rest = raw;
  while (rest.length > 0) {
    let match: RegExpMatchArray | null;
    if ((match = rest.match(/^(import|from|export|default|async|function|await|const|return)\b/))) {
      segs.push({ text: match[0], color: '#c084fc' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^(prerender|cache|Suspense|App|signal|controller|prelude|postponed|savePostponedState|resumeOnServer)\b/))) {
      segs.push({ text: match[0], color: '#67e8f9' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^'[^']*'/))) {
      segs.push({ text: match[0], color: '#a5f3fc' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^"[^"]*"/))) {
      segs.push({ text: match[0], color: '#a5f3fc' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^(<\/?[\w]+>?|<[\w]+\s|\/?>)/))) {
      segs.push({ text: match[0], color: '#f87171' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^[{}]/))) {
      segs.push({ text: match[0], color: '#fbbf24' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^[()]/))) {
      segs.push({ text: match[0], color: '#e2e8f0' });
      rest = rest.slice(match[0].length);
    } else if ((match = rest.match(/^[=:.,;]/))) {
      segs.push({ text: match[0], color: '#94a3b8' });
      rest = rest.slice(match[0].length);
    } else {
      segs.push({ text: rest[0], color: '#e2e8f0' });
      rest = rest.slice(1);
    }
  }
  return segs;
}

function renderTokens(tokens: Seg[]): React.ReactNode {
  return tokens.map((s, i) => (
    <span key={i} style={{ color: s.color }}>{s.text}</span>
  ));
}

// ── Static + dynamic code example ────────────────────────────────────────────

const APP_CODE = [
  '// page.tsx — React Server Component with PPR',
  'export default async function OrderPage() {',
  '  return (',
  '    <Layout>',
  '      <Header />           {/* ← Static: pre-rendered at build */}',
  '',
  '      <Suspense fallback={<MenuSkeleton />}>',
  '        <Menu items={await db.menuItems()} />',
  '      </Suspense>          {/* ← Dynamic: resumed at request time */}',
  '',
  '      <Suspense fallback={<CartSkeleton />}>',
  '        <Cart user={await getUser()} />',
  '      </Suspense>',
  '',
  '      <Suspense fallback={<ReviewsSkeleton />}>',
  '        <Reviews data={await db.reviews()} />',
  '      </Suspense>',
  '    </Layout>',
  '  );',
  '}',
];

const PRERENDER_CODE = [
  "import { prerender } from 'react-dom/static';",
  '',
  '// Build time (simplified): render, abort to freeze dynamic holes',
  'const controller = new AbortController();',
  'setTimeout(() => controller.abort()); // abort after sync work',
  'const { prelude, postponed } = await prerender(<App />, {',
  '  signal: controller.signal',
  '});',
  '',
  '// Cache static HTML shell on CDN',
  'await cdn.put(route, prelude);',
  '',
  '// Save postponed state for request-time resume',
  'await savePostponedState(route, postponed);',
];

const RESUME_CODE = [
  "import { resume } from 'react-dom/server';",
  '',
  '// At request time: resume from postponed state (simplified)',
  'const postponed = await getPostponedState(route);',
  'const stream = await resume(<App />, postponed);',
  '',
  '// Pipe dynamic HTML chunks to the response writable stream',
  'stream.pipeTo(response.writable);',
];

const APP_TOKENS = APP_CODE.map(tokenizeCode);
const PRERENDER_TOKENS = PRERENDER_CODE.map(tokenizeCode);
const RESUME_TOKENS = RESUME_CODE.map(tokenizeCode);

// ── Code highlight colors for static vs dynamic lines ────────────────────────

const STATIC_LINES = new Set([3, 4]);
const DYNAMIC_LINES = new Set([6, 7, 8, 10, 11, 12, 14, 15, 16]);

// ── Component ────────────────────────────────────────────────────────────────

export default function PprWalkthrough() {
  const [stepIndex, setStepIndex] = useState(-1);
  const [effMs, setEffMs] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopRaf, [stopRaf]);

  const advance = useCallback(() => {
    if (animating) return;
    const next = stepIndex + 1;
    if (next >= STEPS.length) return;

    setNoteVisible(false);
    setStepIndex(next);

    const startEff = effMs;
    const targetEff = STEPS[next].effEnd;
    const effDelta = targetEff - startEff;
    const duration = Math.max(400, Math.min(2500, effDelta * 0.7));
    const startTime = performance.now();

    setAnimating(true);
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      setEffMs(startEff + effDelta * easeInOutSine(progress));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setEffMs(targetEff);
        setAnimating(false);
        setTimeout(() => setNoteVisible(true), 200);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stepIndex, effMs, animating, stopRaf]);

  const goBack = useCallback(() => {
    if (animating || stepIndex <= 0) return;
    stopRaf();
    const prev = stepIndex - 1;
    setStepIndex(prev);
    setEffMs(STEPS[prev].effEnd);
    setAnimating(false);
    setNoteVisible(true);
  }, [stepIndex, animating, stopRaf]);

  const reset = useCallback(() => {
    stopRaf();
    setStepIndex(-1);
    setEffMs(0);
    setAnimating(false);
    setNoteVisible(false);
  }, [stopRaf]);

  const sectionStates = getSectionStates(effMs);
  const overallProgress = effMs / TOTAL_EFF;
  const currentStep = stepIndex >= 0 ? STEPS[stepIndex] : null;
  const shellPainted = effMs >= SHELL_FCP;
  const allContentVisible = effMs >= Math.max(REVIEWS_VISIBLE, RECS_VISIBLE);
  const fullyInteractive = effMs >= TTI_EFF;

  const totalSections = 6;
  const loadedCount = Object.values(sectionStates).filter((s) => s === 'loaded' || s === 'interactive').length;
  const interactiveCount = Object.values(sectionStates).filter((s) => s === 'interactive').length;

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════
          PART 1: PPR Introduction — Code + Concept
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600">
          <h3 className="text-lg font-bold text-white">Partial Prerendering (PPR)</h3>
          <p className="text-violet-200 text-sm mt-1">
            Pre-render static parts at build time, stream dynamic parts at request time — in parallel
          </p>
        </div>

        {/* Concept overview */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-4">
            <ConceptCard
              step="1"
              title="Build Time"
              desc="React's prerender() API renders the page and aborts via AbortSignal. Async Suspense boundaries that haven't resolved are frozen as 'postponed' state. The output is a static HTML shell with skeleton fallbacks baked in."
              color="#8b5cf6"
              icon={<BuildIcon />}
            />
            <ConceptCard
              step="2"
              title="CDN Edge"
              desc="The static shell is cached at the CDN edge. When a user requests the page, they get the shell in ~30ms — edge speed, no origin hit needed for the first paint."
              color="#10b981"
              icon={<CdnIcon />}
            />
            <ConceptCard
              step="3"
              title="Origin Resume"
              desc="Simultaneously, the CDN connects to the origin server which calls resume(). It re-renders the tree, skipping prerendered subtrees and only doing work for postponed boundaries. Chunks stream into the same HTTP response."
              color="#6366f1"
              icon={<ServerIcon />}
            />
          </div>
        </div>

        {/* Code panels */}
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          {/* App code */}
          <div>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">React Component</span>
            </div>
            <div className="bg-slate-900 p-4 font-mono text-[10px] leading-[18px] overflow-x-auto min-h-[320px]">
              {APP_TOKENS.map((tokens, i) => (
                <div
                  key={i}
                  className="flex"
                  style={{
                    backgroundColor: STATIC_LINES.has(i)
                      ? 'rgba(16, 185, 129, 0.08)'
                      : DYNAMIC_LINES.has(i)
                        ? 'rgba(99, 102, 241, 0.08)'
                        : undefined,
                    borderLeft: STATIC_LINES.has(i)
                      ? '2px solid #10b981'
                      : DYNAMIC_LINES.has(i)
                        ? '2px solid #6366f1'
                        : '2px solid transparent',
                    paddingLeft: '10px',
                  }}
                >
                  <span className="text-slate-600 w-5 text-right mr-3 select-none">{i + 1}</span>
                  <span className="flex-1">{renderTokens(tokens)}</span>
                </div>
              ))}
              <div className="mt-3 flex gap-4 text-[9px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 rounded" />
                  <span className="text-emerald-400">Static (build-time)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-indigo-500 rounded" />
                  <span className="text-indigo-400">Dynamic (request-time)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Prerender API */}
          <div>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Build Time</span>
            </div>
            <div className="bg-slate-900 p-4 font-mono text-[10px] leading-[18px] overflow-x-auto min-h-[320px]">
              {PRERENDER_TOKENS.map((tokens, i) => (
                <div key={i} className="flex" style={{ paddingLeft: '10px' }}>
                  <span className="text-slate-600 w-5 text-right mr-3 select-none">{i + 1}</span>
                  <span className="flex-1">{renderTokens(tokens)}</span>
                </div>
              ))}

              <div className="mt-6 border-t border-slate-700 pt-3">
                <div className="text-[9px] text-slate-500 mb-2">Build output:</div>
                <div className="space-y-1.5">
                  <OutputItem icon="📄" label="prelude" desc="Static HTML with skeleton fallbacks" color="#10b981" />
                  <OutputItem icon="💾" label="postponed" desc="Serialized state for dynamic boundaries" color="#6366f1" />
                </div>
              </div>
            </div>
          </div>

          {/* Resume API */}
          <div>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Request Time (Origin)</span>
            </div>
            <div className="bg-slate-900 p-4 font-mono text-[10px] leading-[18px] overflow-x-auto min-h-[320px]">
              {RESUME_TOKENS.map((tokens, i) => (
                <div key={i} className="flex" style={{ paddingLeft: '10px' }}>
                  <span className="text-slate-600 w-5 text-right mr-3 select-none">{i + 1}</span>
                  <span className="flex-1">{renderTokens(tokens)}</span>
                </div>
              ))}

              <div className="mt-6 border-t border-slate-700 pt-3">
                <div className="text-[9px] text-slate-500 mb-2">At request time:</div>
                <div className="space-y-1.5">
                  <OutputItem icon="⚡" label="resume()" desc="Skips prerendered subtrees, renders postponed boundaries" color="#f59e0b" />
                  <OutputItem icon="🌊" label="stream" desc="Chunks flow to the browser as they resolve" color="#3b82f6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key insight bar */}
        <div className="px-6 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-t border-violet-100">
          <p className="text-[12px] text-violet-800 leading-relaxed">
            <strong>The single HTTP response trick:</strong> The CDN starts streaming the cached static shell to the browser,
            then appends dynamic chunks from the origin onto the same response as they resolve.
            The browser sees one request, one response — but the content comes from two sources in parallel.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PART 2: Animated PPR Walkthrough
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        {/* ── Progress bar with milestones ──────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
          <div className="relative h-2 bg-slate-200 rounded-full overflow-visible mb-6">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${overallProgress * 100}%`,
                background: 'linear-gradient(90deg, #10b981, #6366f1)',
              }}
            />
            {STEPS.filter((s) => s.marker).map((s) => {
              const pos = (s.effEnd / TOTAL_EFF) * 100;
              const reached = effMs >= s.effEnd;
              return (
                <div key={s.id} className="absolute" style={{ left: `${pos}%`, top: '-3px' }}>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm -translate-x-1/2 transition-colors ${reached ? '' : 'bg-slate-300'}`}
                    style={reached ? { backgroundColor: s.markerColor } : undefined}
                  />
                  <span
                    className="absolute top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap"
                    style={{ color: reached ? s.markerColor : '#94a3b8' }}
                  >
                    {s.marker}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentStep ? (
                <>
                  <span className="text-sm font-bold text-slate-800">{currentStep.label}</span>
                  {currentStep.marker && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: (currentStep.markerColor || '#666') + '18',
                        color: currentStep.markerColor,
                      }}
                    >
                      {currentStep.marker}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-400">Ready to start</span>
              )}
              {animating && (
                <span className="text-[11px] text-indigo-500 font-medium animate-pulse ml-2">Loading...</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              {stepIndex >= 0 && stepIndex < STEPS.length - 1 ? (
                <button
                  onClick={advance}
                  disabled={animating}
                  className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : stepIndex >= STEPS.length - 1 ? (
                <button
                  onClick={reset}
                  className="flex items-center gap-1 px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Start Over
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Dual network waterfall: Browser + Origin ────────────────── */}
        <div className="bg-slate-900 px-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            {/* Browser downloads (from CDN) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-emerald-400 font-mono font-semibold tracking-wider uppercase">Browser ← CDN</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <div className="space-y-1">
                {BROWSER_SIM.map((r) => {
                  const discovered = effMs >= r.discoverEff;
                  const approaching = effMs >= r.discoverEff - 200;
                  const done = effMs >= r.endEff;
                  if (stepIndex < 0 || !approaching) return null;

                  const maxEnd = BROWSER_MAX_END;
                  const barLeft = (r.discoverEff / maxEnd) * 100;
                  const currentEnd = Math.min(effMs, r.endEff);
                  const barWidth = discovered ? ((currentEnd - r.discoverEff) / maxEnd) * 100 : 0;

                  return (
                    <div key={r.name} className="flex items-center gap-2 h-[18px]">
                      <span className={`text-[9px] font-mono w-[110px] text-right truncate ${discovered ? 'text-slate-300' : 'text-slate-600'}`}>
                        {r.name}
                      </span>
                      <div className="flex-1 relative h-[10px] bg-slate-800 rounded-sm overflow-hidden">
                        {barWidth > 0 && (
                          <div
                            className="absolute inset-y-0 rounded-sm"
                            style={{
                              left: `${barLeft}%`,
                              width: `${Math.max(barWidth, 0.5)}%`,
                              backgroundColor: r.color,
                              opacity: done ? 1 : 0.7,
                            }}
                          />
                        )}
                      </div>
                      <span className={`text-[8px] font-mono w-10 text-right ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                        {done ? r.label : discovered ? `${Math.round(getProgress(r, effMs) * r.sizeKb)} KB` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Origin server (running in parallel) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-indigo-400 font-mono font-semibold tracking-wider uppercase">Origin Server (parallel)</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <div className="space-y-1">
                {ORIGIN_SIM.map((r) => {
                  const discovered = effMs >= r.discoverEff;
                  const approaching = effMs >= r.discoverEff - 200;
                  const done = effMs >= r.endEff;
                  if (stepIndex < 0 || !approaching) return null;

                  const maxEnd = ORIGIN_MAX_END;
                  const barLeft = (r.discoverEff / maxEnd) * 100;
                  const currentEnd = Math.min(effMs, r.endEff);
                  const barWidth = discovered ? ((currentEnd - r.discoverEff) / maxEnd) * 100 : 0;

                  return (
                    <div key={r.name} className="flex items-center gap-2 h-[18px]">
                      <span className={`text-[9px] font-mono w-[110px] text-right truncate ${discovered ? 'text-slate-300' : 'text-slate-600'}`}>
                        {r.name}
                      </span>
                      <div className="flex-1 relative h-[10px] bg-slate-800 rounded-sm overflow-hidden">
                        {barWidth > 0 && (
                          <div
                            className="absolute inset-y-0 rounded-sm"
                            style={{
                              left: `${barLeft}%`,
                              width: `${Math.max(barWidth, 0.5)}%`,
                              backgroundColor: r.color,
                              opacity: done ? 1 : 0.7,
                            }}
                          />
                        )}
                      </div>
                      <span className={`text-[8px] font-mono w-10 text-right ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                        {done ? r.label : discovered ? `${Math.round(getProgress(r, effMs) * r.sizeKb)} KB` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Insight note ────────────────────────────────────────────── */}
        {stepIndex >= 0 && (
          <div className="border-t border-slate-200">
            <div className="p-5 bg-gradient-to-b from-slate-50/80 to-white">
              <div className={`transition-all duration-300 ease-out ${noteVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
                {currentStep && (
                  <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-indigo-500" />

                    <div className="pl-6 pr-5 py-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-0.5 rounded-full shadow-sm">
                          {stepIndex + 1} / {STEPS.length}
                        </span>
                        <h4 className="text-base font-bold text-slate-900">{currentStep.note.title}</h4>
                      </div>

                      <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{currentStep.note.body}</p>

                      <div className="bg-violet-50/80 border-l-[3px] border-violet-400 rounded-r-lg px-4 py-3 mb-5">
                        <div className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-0.5">Key Insight</div>
                        <p className="text-[12px] text-violet-900/80 leading-relaxed">{currentStep.note.insight}</p>
                      </div>

                      <div className="flex gap-1.5">
                        {STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i < stepIndex ? 'bg-violet-300' : i === stepIndex ? 'bg-violet-600' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!noteVisible && animating && (
                <div className="flex items-center justify-center py-6">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    Simulating...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Browser mockup ─────────────────────────────────────────── */}
        <div className="border-t border-slate-700">
          <div className="h-7 bg-gradient-to-b from-slate-600 to-slate-700 flex items-center px-3 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400/80" />
            <span className="w-2 h-2 rounded-full bg-amber-400/80" />
            <span className="w-2 h-2 rounded-full bg-green-400/80" />
            <div className="flex-1 mx-4">
              <div className="bg-slate-800/60 rounded px-2 py-0.5 text-[8px] text-slate-400 text-center">
                bellas-pizza.com/order
              </div>
            </div>
          </div>

          <div className="relative min-h-[380px] bg-white">
            {/* Pre-start state */}
            {stepIndex < 0 && (
              <div className="h-[380px] flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    See how PPR loads your restaurant page &mdash; step by step
                  </p>
                  <button
                    onClick={advance}
                    className="px-7 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                  >
                    Start Walkthrough
                  </button>
                </div>
              </div>
            )}

            {/* Loading state before shell paints */}
            {stepIndex >= 0 && !shellPainted && (
              <div className="h-[380px] flex items-center justify-center">
                <div className="text-sm text-slate-300">
                  {effMs < CDN_LATENCY ? 'Requesting page from CDN edge...' : 'Downloading static shell...'}
                </div>
              </div>
            )}

            {/* Shell painted — sections progressively fill in */}
            {stepIndex >= 0 && shellPainted && (
              <div>
                {/* Header — static, always visible when shell paints */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 text-sm font-bold">B</div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">Bella&apos;s Pizza</div>
                        <div className="text-[10px] text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9734; 4.2 &middot; Open &middot; $$</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {['Menu', 'Reviews', 'Info'].map((t) => (
                        <span key={t} className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-500 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                  <StatusBadge state={sectionStates.header} label="Header (static)" />
                </div>

                {/* Menu section — Suspense boundary */}
                <SuspenseBoundary state={sectionStates.menu} label="Menu" dataSource="db.menuItems()">
                  {sectionStates.menu === 'skeleton' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-2 animate-pulse">
                          <div className="w-full h-7 bg-slate-200 rounded mb-1" />
                          <div className="h-2 bg-slate-200 rounded w-3/4 mx-auto mb-1" />
                          <div className="h-2 bg-slate-200 rounded w-1/2 mx-auto" />
                        </div>
                      ))}
                    </div>
                  ) : sectionStates.menu === 'loaded' || sectionStates.menu === 'interactive' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'Margherita', price: '$12.99', bg: 'bg-red-50', border: 'border-red-100', accent: 'text-red-600' },
                        { name: 'Pepperoni', price: '$14.99', bg: 'bg-orange-50', border: 'border-orange-100', accent: 'text-orange-600' },
                        { name: 'Caesar Salad', price: '$10.99', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'text-emerald-600' },
                        { name: 'Garlic Bread', price: '$6.99', bg: 'bg-amber-50', border: 'border-amber-100', accent: 'text-amber-600' },
                        { name: 'Tiramisu', price: '$8.99', bg: 'bg-yellow-50', border: 'border-yellow-100', accent: 'text-yellow-700' },
                        { name: 'Gelato', price: '$5.99', bg: 'bg-sky-50', border: 'border-sky-100', accent: 'text-sky-600' },
                      ].map((item) => (
                        <div key={item.name} className={`${item.bg} rounded-lg border ${item.border} p-2 text-center transition-all duration-300`}
                          style={{ opacity: sectionStates.menu === 'interactive' ? 1 : 0.7 }}
                        >
                          <div className={`w-full h-7 ${item.bg} rounded mb-1 flex items-center justify-center`}>
                            <div className={`w-5 h-5 rounded-full ${item.bg} border ${item.border}`} />
                          </div>
                          <div className="text-[8px] font-semibold text-slate-700">{item.name}</div>
                          <div className={`text-[8px] font-bold ${item.accent}`}>{item.price}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </SuspenseBoundary>

                {/* Cart section — Suspense boundary */}
                <SuspenseBoundary state={sectionStates.cart} label="Cart" dataSource="getUser()">
                  {sectionStates.cart === 'skeleton' ? (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                          <div>
                            <div className="h-2.5 bg-slate-200 rounded w-20 mb-1" />
                            <div className="h-2 bg-slate-200 rounded w-16" />
                          </div>
                        </div>
                        <div className="h-5 bg-slate-200 rounded w-16" />
                      </div>
                    </div>
                  ) : sectionStates.cart === 'loaded' || sectionStates.cart === 'interactive' ? (
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"
                      style={{ opacity: sectionStates.cart === 'interactive' ? 1 : 0.7 }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-[10px] font-bold">C</div>
                        <div>
                          <div className="text-[10px] font-semibold text-slate-700">Your Cart (2 items)</div>
                          <div className="text-[8px] text-slate-400">Margherita, Pepperoni</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-800">$27.98</div>
                        <div className={`text-[8px] rounded px-1.5 py-0.5 font-semibold ${sectionStates.cart === 'interactive' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                          {sectionStates.cart === 'interactive' ? 'Checkout' : 'Checkout'}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </SuspenseBoundary>

                {/* Delivery section — Suspense boundary */}
                <SuspenseBoundary state={sectionStates.delivery} label="Delivery" dataSource="getDeliveryZones()">
                  {sectionStates.delivery === 'skeleton' ? (
                    <div className="flex items-center gap-2 animate-pulse">
                      <div className="w-5 h-5 bg-slate-200 rounded" />
                      <div className="h-2.5 bg-slate-200 rounded w-32" />
                    </div>
                  ) : sectionStates.delivery === 'loaded' || sectionStates.delivery === 'interactive' ? (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500"
                      style={{ opacity: sectionStates.delivery === 'interactive' ? 1 : 0.7 }}
                    >
                      <div className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-[8px] text-slate-400">T</div>
                      <span className="font-medium">Est. 25&ndash;35 min</span>
                      <span className="text-slate-300">&middot;</span>
                      <span className="text-emerald-600 font-medium">Free delivery over $30</span>
                    </div>
                  ) : null}
                </SuspenseBoundary>

                {/* Reviews section — Suspense boundary (Server Component) */}
                <SuspenseBoundary state={sectionStates.reviews} label="Reviews" dataSource="reviewAPI.aggregate()" isServerComponent>
                  {sectionStates.reviews === 'skeleton' ? (
                    <div className="animate-pulse">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="h-3 bg-slate-200 rounded w-24 mb-1" />
                          <div className="h-2 bg-slate-200 rounded w-20" />
                        </div>
                        <div className="h-3 bg-slate-200 rounded w-12" />
                      </div>
                    </div>
                  ) : sectionStates.reviews === 'loaded' || sectionStates.reviews === 'interactive' ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-700">Customer Reviews</div>
                        <div className="text-[9px] text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9734; &middot; 142 reviews</div>
                      </div>
                      <span className="text-[9px] text-indigo-500 font-medium">See all &#8594;</span>
                    </div>
                  ) : null}
                </SuspenseBoundary>

                {/* Recommendations section — Suspense boundary */}
                <SuspenseBoundary state={sectionStates.recommendations} label="Recs" dataSource="mlEngine.recommend()">
                  {sectionStates.recommendations === 'skeleton' ? (
                    <div className="animate-pulse">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="h-3 bg-slate-200 rounded w-28" />
                        <div className="h-3 bg-slate-200 rounded w-4" />
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((i) => <div key={i} className="flex-1 h-10 bg-slate-100 rounded-lg" />)}
                      </div>
                    </div>
                  ) : sectionStates.recommendations === 'loaded' || sectionStates.recommendations === 'interactive' ? (
                    <div style={{ opacity: sectionStates.recommendations === 'interactive' ? 1 : 0.7 }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[11px] font-bold text-slate-700">Recommended for you</div>
                        <span className="text-[9px] text-indigo-500 font-medium">&#8594;</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((i) => <div key={i} className="flex-1 h-10 bg-slate-50 rounded-lg border border-slate-100" />)}
                      </div>
                    </div>
                  ) : null}
                </SuspenseBoundary>
              </div>
            )}

            {/* Three-state overlay badge */}
            {stepIndex >= 0 && shellPainted && (
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {fullyInteractive ? (
                  <div className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-1 rounded-md shadow-sm border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    All Interactive ({totalSections}/{totalSections})
                  </div>
                ) : (
                  <>
                    {interactiveCount > 0 && (
                      <div className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        Interactive: {interactiveCount}
                      </div>
                    )}
                    {loadedCount - interactiveCount > 0 && (
                      <div className="bg-amber-50 text-amber-700 text-[8px] font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Not Interactive: {loadedCount - interactiveCount}
                      </div>
                    )}
                    {totalSections - loadedCount > 0 && (
                      <div className="bg-slate-50 text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" />
                        Skeleton: {totalSections - loadedCount}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SuspenseBoundary({ state, label, dataSource, isServerComponent, children }: {
  state: string;
  label: string;
  dataSource: string;
  isServerComponent?: boolean;
  children: React.ReactNode;
}) {
  const borderColor = state === 'interactive'
    ? 'border-emerald-300'
    : state === 'loaded'
      ? 'border-amber-300'
      : 'border-slate-200 border-dashed';

  const bgColor = state === 'interactive'
    ? 'bg-emerald-50/30'
    : state === 'loaded'
      ? 'bg-amber-50/20'
      : 'bg-slate-50/50';

  return (
    <div className={`mx-3 my-2 rounded-lg border-2 ${borderColor} ${bgColor} relative transition-all duration-500`}>
      <div className="absolute -top-2.5 left-3 flex items-center gap-1.5">
        <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded ${
          state === 'interactive' ? 'bg-emerald-100 text-emerald-700'
            : state === 'loaded' ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
        }`}>
          &lt;Suspense&gt;
        </span>
        {isServerComponent && (
          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">
            Server Component
          </span>
        )}
        <span className="text-[7px] text-slate-400 font-mono">{dataSource}</span>
      </div>
      <div className="px-3 pt-4 pb-2">
        {children}
        <StatusBadge state={state} label={label} />
      </div>
    </div>
  );
}

function ConceptCard({ step, title, desc, color, icon }: {
  step: string; title: string; desc: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          {icon}
        </div>
        <div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Step {step}</div>
          <div className="text-[13px] font-bold text-slate-800">{title}</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function OutputItem({ icon, label, desc, color }: {
  icon: string; label: string; desc: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px]">{icon}</span>
      <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
      <span className="text-[9px] text-slate-500">— {desc}</span>
    </div>
  );
}

function StatusBadge({ state, label }: { state: string; label: string }) {
  if (state === 'hidden') return null;

  if (state === 'skeleton') {
    return (
      <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-slate-100 border border-dashed border-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
        <span className="text-[8px] font-semibold text-slate-400">&lt;Suspense&gt; {label}</span>
        <span className="text-[7px] text-slate-400">— waiting for server</span>
      </div>
    );
  }

  if (state === 'loaded') {
    return (
      <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200">
        <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-[8px] font-semibold text-amber-700">{label}: Content Visible</span>
        <span className="text-[7px] text-amber-500">— not yet interactive</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200">
      <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-[8px] font-semibold text-emerald-700">{label}: Interactive</span>
      <span className="text-[7px] text-emerald-500">— hydrated</span>
    </div>
  );
}

function BuildIcon() {
  return (
    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function CdnIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

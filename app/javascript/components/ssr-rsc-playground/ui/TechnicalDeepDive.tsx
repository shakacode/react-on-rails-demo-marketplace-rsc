'use client';

import React, { useState } from 'react';
import type { SimulationResult, TimelineSegment } from '../types';

interface TechnicalDeepDiveProps {
  result: SimulationResult;
  playheadMs: number;
}

const PADDING_LEFT = 160;
const PADDING_RIGHT = 40;
const ROW_HEIGHT = 24;
const ROW_GAP = 3;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;

function dedupeRowLabels(segments: TimelineSegment[]): Map<number, string> {
  const labels = new Map<number, string>();
  for (const seg of segments) {
    if (!labels.has(seg.row)) labels.set(seg.row, seg.label);
  }
  return labels;
}

function GanttChart({
  title,
  segments,
  milestones,
  playheadMs,
  maxDurationMs,
}: {
  title: string;
  segments: TimelineSegment[];
  milestones: { id: string; label: string; timeMs: number; color: string }[];
  playheadMs: number;
  maxDurationMs: number;
}) {
  if (maxDurationMs === 0) return null;

  const maxRow = Math.max(0, ...segments.map((s) => s.row));
  const chartWidth = 600;
  const svgWidth = PADDING_LEFT + chartWidth + PADDING_RIGHT;
  const svgHeight = PADDING_TOP + (maxRow + 1) * (ROW_HEIGHT + ROW_GAP) + PADDING_BOTTOM;
  const playheadX = PADDING_LEFT + (playheadMs / maxDurationMs) * chartWidth;
  const rowLabels = dedupeRowLabels(segments);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const visibleMilestones = milestones.filter((m) => playheadMs >= m.timeMs - 1);

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-slate-600 mb-1">{title}</div>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" role="img" aria-label={title}>
        {Array.from(rowLabels.entries()).map(([row, label]) => (
          <text
            key={`lbl-${row}`}
            x={PADDING_LEFT - 6}
            y={PADDING_TOP + row * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2}
            textAnchor="end"
            dominantBaseline="central"
            className="text-[9px] font-medium"
            fill="#64748b"
          >
            {label.length > 28 ? label.slice(0, 26) + '..' : label}
          </text>
        ))}

        {segments.map((seg) => {
          const progress = clamp01((playheadMs - seg.startMs) / (seg.endMs - seg.startMs));
          const fullWidth = ((seg.endMs - seg.startMs) / maxDurationMs) * chartWidth;
          const x = PADDING_LEFT + (seg.startMs / maxDurationMs) * chartWidth;
          const y = PADDING_TOP + seg.row * (ROW_HEIGHT + ROW_GAP);
          const width = fullWidth * progress;

          return (
            <g key={seg.id}>
              <rect x={x} y={y} width={fullWidth} height={ROW_HEIGHT} rx={3} fill={seg.color} opacity={0.12} />
              {width > 0 && <rect x={x} y={y} width={width} height={ROW_HEIGHT} rx={3} fill={seg.color} opacity={0.8} />}
              {fullWidth > 40 && (
                <text x={x + 5} y={y + ROW_HEIGHT / 2} dominantBaseline="central" className="text-[7px]" fill={progress > 0.3 ? 'white' : '#94a3b8'} style={{ pointerEvents: 'none' }}>
                  {Math.round(seg.endMs - seg.startMs)}ms
                </text>
              )}
            </g>
          );
        })}

        {visibleMilestones.map((m, i) => {
          const mx = PADDING_LEFT + (m.timeMs / maxDurationMs) * chartWidth;
          const pct = m.timeMs / maxDurationMs;
          const anchor = pct > 0.85 ? ('end' as const) : pct < 0.15 ? ('start' as const) : ('middle' as const);
          return (
            <g key={m.id}>
              <line x1={mx} y1={PADDING_TOP - 4} x2={mx} y2={svgHeight - PADDING_BOTTOM + 4} stroke={m.color} strokeWidth={1.5} strokeDasharray="4 2" />
              <text x={mx} y={svgHeight - PADDING_BOTTOM + 16 + i * 12} textAnchor={anchor} className="text-[8px] font-semibold" fill={m.color}>
                {m.label}
              </text>
            </g>
          );
        })}

        <line x1={playheadX} y1={PADDING_TOP - 4} x2={playheadX} y2={svgHeight - PADDING_BOTTOM + 4} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
        <circle cx={playheadX} cy={PADDING_TOP - 4} r={3} fill="#ef4444" />
      </svg>
    </div>
  );
}

const EXPLANATIONS = [
  {
    title: 'CSS',
    ssr: 'ALL CSS in <head>. Browser paints nothing until every stylesheet downloads. Adding a section’s CSS delays the entire page’s first paint.',
    rsc: 'Each Suspense boundary carries its own CSS. Menu’s CSS doesn’t block Header from painting.',
  },
  {
    title: 'JavaScript',
    ssr: 'Every component ships its JS to the browser — even purely presentational ones. A Reviews section that just displays text still ships its rendering code.',
    rsc: 'Server Components ship zero JS. Only interactive Client Components (buttons, forms) ship code. Typical 60–70% bundle reduction.',
  },
  {
    title: 'Props & Data',
    ssr: 'ALL component props serialized as JSON in a <script> tag. The entire data tree ships to the browser for hydration — even fields never displayed.',
    rsc: 'Only props crossing the server→client boundary are sent. Server components consume data on the server; only client component props cross the wire.',
  },
  {
    title: 'Hydration',
    ssr: 'One monolithic pass. React re-executes the entire component tree, diffs against DOM, attaches handlers. Nothing is interactive until everything finishes.',
    rsc: 'Selective hydration per Suspense boundary. If a user clicks Cart while Reviews is hydrating, React pauses Reviews and hydrates Cart first.',
  },
  {
    title: 'Download Size',
    ssr: 'One large HTML response. More sections = more bytes before anything starts. Exceeding 14 KB (TCP slow start) adds extra round trips.',
    rsc: 'Tiny shell first, then each boundary streams as its data resolves. Earlier content isn’t delayed by later content.',
  },
];

export default function TechnicalDeepDive({ result, playheadMs }: TechnicalDeepDiveProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <h2 className="text-base font-bold text-slate-800">Why does this happen?</h2>
          <p className="text-sm text-slate-500">The technical deep-dive</p>
        </div>
        <span className={`text-slate-400 text-lg transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-slate-100 pt-4">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <GanttChart
                title="SSR: Everything is coupled"
                segments={result.ssr.segments}
                milestones={result.ssr.milestones}
                playheadMs={playheadMs}
                maxDurationMs={result.maxDurationMs}
              />
              <div className="text-[10px] text-slate-500 mt-1">
                CSS must ALL load before ANY paint. Hydration is one pass — no section is interactive until all finish.
              </div>
            </div>
            <div>
              <GanttChart
                title="RSC: Everything is independent"
                segments={result.rsc.segments}
                milestones={result.rsc.milestones}
                playheadMs={playheadMs}
                maxDurationMs={result.maxDurationMs}
              />
              <div className="text-[10px] text-slate-500 mt-1">
                Each boundary brings its own CSS. Sections hydrate independently. Click triggers priority hydration.
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-700 mb-3">
            5 things that cascade in SSR but are isolated in RSC
          </h3>
          <div className="space-y-3">
            {EXPLANATIONS.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">{item.title}</div>
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-bold text-amber-600 mb-1">SSR</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">{item.ssr}</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-bold text-emerald-600 mb-1">RSC</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">{item.rsc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <blockquote className="text-sm text-slate-700 italic leading-relaxed">
              &ldquo;The base client-side runtime is cacheable and predictable in size, and does not increase as your
              application grows.&rdquo;
            </blockquote>
            <div className="text-xs text-slate-500 mt-1">— React Documentation</div>
          </div>
        </div>
      )}
    </div>
  );
}

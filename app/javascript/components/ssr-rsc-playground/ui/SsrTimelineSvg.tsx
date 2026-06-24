'use client';

import React from 'react';
import type { Milestone, Segment } from '../types';

interface SsrTimelineSvgProps {
  segments: Segment[];
  milestones: Milestone[];
  playheadMs: number;
  maxDurationMs: number;
}

const PADDING_LEFT = 170;
const PADDING_RIGHT = 60;
const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const PADDING_TOP = 30;
const PADDING_BOTTOM = 60;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function TimeAxis({ maxDurationMs, chartWidth }: { maxDurationMs: number; chartWidth: number }) {
  const ticks: number[] = [];
  const step = maxDurationMs <= 500 ? 100 : maxDurationMs <= 2000 ? 250 : maxDurationMs <= 5000 ? 500 : 1000;
  for (let t = 0; t <= maxDurationMs; t += step) {
    ticks.push(t);
  }
  return (
    <>
      {ticks.map((t) => {
        const x = PADDING_LEFT + (t / maxDurationMs) * chartWidth;
        return (
          <g key={t}>
            <line x1={x} y1={PADDING_TOP - 8} x2={x} y2={PADDING_TOP - 4} stroke="#cbd5e1" strokeWidth={1} />
            <text x={x} y={PADDING_TOP - 12} textAnchor="middle" className="text-[9px]" fill="#94a3b8">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`}
            </text>
          </g>
        );
      })}
    </>
  );
}

function dedupeRowLabels(segments: Segment[]): Map<number, string> {
  const labels = new Map<number, string>();
  for (const seg of segments) {
    if (!labels.has(seg.row)) {
      labels.set(seg.row, seg.label);
    }
  }
  return labels;
}

function spreadMilestoneYOffsets(milestones: Milestone[], maxDurationMs: number, chartWidth: number): number[] {
  const positions = milestones.map((m) => PADDING_LEFT + (m.timeMs / maxDurationMs) * chartWidth);
  const offsets = new Array(milestones.length).fill(0);
  const MIN_X_GAP = 70;

  for (let i = 1; i < positions.length; i++) {
    let collides = true;
    while (collides) {
      collides = false;
      for (let j = 0; j < i; j++) {
        if (Math.abs(positions[i] - positions[j]) < MIN_X_GAP && offsets[i] === offsets[j]) {
          offsets[i] = offsets[j] + 12;
          collides = true;
        }
      }
    }
  }
  return offsets;
}

export default function SsrTimelineSvg({ segments, milestones, playheadMs, maxDurationMs }: SsrTimelineSvgProps) {
  if (maxDurationMs === 0) return null;

  const maxRow = Math.max(0, ...segments.map((s) => s.row));
  const chartWidth = 700;
  const svgWidth = PADDING_LEFT + chartWidth + PADDING_RIGHT;
  const svgHeight = PADDING_TOP + (maxRow + 1) * (ROW_HEIGHT + ROW_GAP) + PADDING_BOTTOM;

  const playheadX = PADDING_LEFT + (playheadMs / maxDurationMs) * chartWidth;
  const rowLabels = dedupeRowLabels(segments);
  const visibleMilestones = milestones.filter((m) => playheadMs >= m.timeMs - 1);
  const milestoneYOffsets = spreadMilestoneYOffsets(visibleMilestones, maxDurationMs, chartWidth);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      role="img"
      aria-label="SSR loading timeline for restaurant ordering page"
    >
      <TimeAxis maxDurationMs={maxDurationMs} chartWidth={chartWidth} />

      {/* Row labels — one per row, deduplicated */}
      {Array.from(rowLabels.entries()).map(([row, label]) => (
        <text
          key={`label-${row}`}
          x={PADDING_LEFT - 8}
          y={PADDING_TOP + row * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2}
          textAnchor="end"
          dominantBaseline="central"
          className="text-[10px] font-medium"
          fill="#64748b"
        >
          {label.length > 26 ? label.slice(0, 24) + '..' : label}
        </text>
      ))}

      {/* Segment bars */}
      {segments.map((seg) => {
        const progress = clamp01((playheadMs - seg.startMs) / (seg.endMs - seg.startMs));
        const fullWidth = ((seg.endMs - seg.startMs) / maxDurationMs) * chartWidth;
        const x = PADDING_LEFT + (seg.startMs / maxDurationMs) * chartWidth;
        const y = PADDING_TOP + seg.row * (ROW_HEIGHT + ROW_GAP);
        const width = fullWidth * progress;

        return (
          <g key={seg.id}>
            <rect x={x} y={y} width={fullWidth} height={ROW_HEIGHT} rx={4} fill={seg.color} opacity={0.12} />
            {width > 0 && (
              <rect x={x} y={y} width={width} height={ROW_HEIGHT} rx={4} fill={seg.color} opacity={0.85} />
            )}
            {fullWidth > 50 && (
              <text
                x={x + 6}
                y={y + ROW_HEIGHT / 2}
                dominantBaseline="central"
                className="text-[8px]"
                fill={progress > 0.3 ? 'white' : '#64748b'}
                style={{ pointerEvents: 'none' }}
              >
                {Math.round(seg.endMs - seg.startMs)}ms
              </text>
            )}
          </g>
        );
      })}

      {/* Milestone lines and labels */}
      {visibleMilestones.map((m, i) => {
        const mx = PADDING_LEFT + (m.timeMs / maxDurationMs) * chartWidth;
        const yOffset = milestoneYOffsets[i];
        const pct = m.timeMs / maxDurationMs;
        const anchor = pct > 0.85 ? 'end' as const : pct < 0.15 ? 'start' as const : 'middle' as const;
        return (
          <g key={m.id}>
            <line
              x1={mx}
              y1={PADDING_TOP - 4}
              x2={mx}
              y2={svgHeight - PADDING_BOTTOM + 8}
              stroke={m.color}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <text
              x={mx}
              y={svgHeight - PADDING_BOTTOM + 18 + yOffset}
              textAnchor={anchor}
              className="text-[8px] font-semibold"
              fill={m.color}
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {/* Playhead */}
      <line
        x1={playheadX}
        y1={PADDING_TOP - 4}
        x2={playheadX}
        y2={svgHeight - PADDING_BOTTOM + 8}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      <circle cx={playheadX} cy={PADDING_TOP - 4} r={4} fill="#ef4444" />
    </svg>
  );
}

'use client';

import React from 'react';
import type { Connector, Milestone, Segment } from '../types';

interface RscTimelineSvgProps {
  segments: Segment[];
  milestones: Milestone[];
  connectors: Connector[];
  ssrSegments: Segment[];
  playheadMs: number;
  maxDurationMs: number;
}

const PADDING_LEFT = 170;
const PADDING_RIGHT = 60;
const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const PADDING_TOP = 40;
const PADDING_BOTTOM = 70;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const CONNECTOR_COLORS: Record<string, string> = {
  eliminated: '#ef4444',
  overlapped: '#f59e0b',
  streamed: '#10b981',
};

const CONNECTOR_LABELS: Record<string, string> = {
  eliminated: 'Eliminated',
  overlapped: 'Reduced',
  streamed: 'Streamed',
};

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

export default function RscTimelineSvg({
  segments,
  milestones,
  connectors,
  ssrSegments,
  playheadMs,
  maxDurationMs,
}: RscTimelineSvgProps) {
  if (maxDurationMs === 0) return null;

  const maxRow = Math.max(0, ...segments.map((s) => s.row));
  const chartWidth = 700;
  const svgWidth = PADDING_LEFT + chartWidth + PADDING_RIGHT;
  const connectorAreaHeight = 50;
  const svgHeight = connectorAreaHeight + PADDING_TOP + (maxRow + 1) * (ROW_HEIGHT + ROW_GAP) + PADDING_BOTTOM;
  const chartTop = connectorAreaHeight + PADDING_TOP;

  const playheadX = PADDING_LEFT + (playheadMs / maxDurationMs) * chartWidth;
  const rowLabels = dedupeRowLabels(segments);
  const visibleMilestones = milestones.filter((m) => playheadMs >= m.timeMs - 1);
  const milestoneYOffsets = spreadMilestoneYOffsets(visibleMilestones, maxDurationMs, chartWidth);

  const segMidX = (seg: Segment) => PADDING_LEFT + ((seg.startMs + seg.endMs) / 2 / maxDurationMs) * chartWidth;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      role="img"
      aria-label="RSC loading timeline with connectors"
    >
      {/* Connectors from SSR to RSC */}
      {connectors.map((conn, i) => {
        const fromSeg = ssrSegments.find((s) => s.id === conn.fromSegmentId);
        const toSeg = segments.find((s) => s.id === conn.toSegmentId);
        if (!fromSeg || !toSeg) return null;

        const fromX = segMidX(fromSeg);
        const toX = segMidX(toSeg);
        const toY = chartTop + toSeg.row * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
        const fromY = 0;
        const color = CONNECTOR_COLORS[conn.type] ?? '#94a3b8';

        const isActive = playheadMs >= Math.min(fromSeg.startMs, toSeg.startMs);
        const opacity = isActive ? 0.7 : 0.15;
        const labelY = 16 + i * 14;

        return (
          <g key={conn.id}>
            <path
              d={`M ${fromX} ${fromY} C ${fromX} ${connectorAreaHeight / 2}, ${toX} ${connectorAreaHeight / 2}, ${toX} ${toY}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 3"
              opacity={opacity}
              style={{ transition: 'opacity 0.3s' }}
            />
            {isActive && (
              <text
                x={(fromX + toX) / 2}
                y={8 + i * 12}
                textAnchor="middle"
                className="text-[8px] font-medium"
                fill={color}
                opacity={0.85}
              >
                {CONNECTOR_LABELS[conn.type] ?? conn.type}
              </text>
            )}
          </g>
        );
      })}

      {/* Section title */}
      <text x={PADDING_LEFT} y={chartTop - 12} className="text-[11px] font-semibold" fill="#334155">
        RSC Timeline
      </text>

      {/* Row labels — one per row, deduplicated */}
      {Array.from(rowLabels.entries()).map(([row, label]) => (
        <text
          key={`label-${row}`}
          x={PADDING_LEFT - 8}
          y={chartTop + row * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2}
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
        const y = chartTop + seg.row * (ROW_HEIGHT + ROW_GAP);
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
              y1={chartTop - 4}
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
        y1={chartTop - 4}
        x2={playheadX}
        y2={svgHeight - PADDING_BOTTOM + 8}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      <circle cx={playheadX} cy={chartTop - 4} r={4} fill="#ef4444" />

      {/* Legend */}
      <g>
        {[
          { type: 'eliminated', label: 'Eliminated', color: '#ef4444' },
          { type: 'overlapped', label: 'Reduced', color: '#f59e0b' },
          { type: 'streamed', label: 'Streamed', color: '#10b981' },
        ].map((item, i) => (
          <g key={item.type} transform={`translate(${PADDING_LEFT + i * 120}, ${svgHeight - 14})`}>
            <line x1={0} y1={0} x2={16} y2={0} stroke={item.color} strokeWidth={2} strokeDasharray="4 2" />
            <text x={20} y={0} dominantBaseline="central" className="text-[9px]" fill="#64748b">
              {item.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

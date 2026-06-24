'use client';

import React from 'react';
import type { FilmstripFrame, SectionVisualState } from '../types';

interface FilmstripSvgProps {
  ssrFrames: FilmstripFrame[];
  rscFrames: FilmstripFrame[];
  playheadMs: number;
  maxDurationMs: number;
}

const FRAME_WIDTH = 100;
const FRAME_HEIGHT = 150;
const FRAME_GAP = 12;
const PADDING_X = 20;
const SECTION_HEIGHT = 16;
const SECTION_GAP = 3;
const LABEL_WIDTH = 36;
const ROW_GAP = 16;
const TIMELINE_HEIGHT = 8;

const STATE_FILLS: Record<SectionVisualState, { fill: string; stroke: string; opacity: number }> = {
  blank: { fill: '#f1f5f9', stroke: '#e2e8f0', opacity: 0.5 },
  skeleton: { fill: '#e2e8f0', stroke: '#94a3b8', opacity: 0.75 },
  content: { fill: 'white', stroke: '#6366f1', opacity: 1 },
  interactive: { fill: '#6366f1', stroke: '#4f46e5', opacity: 1 },
};

function PageWireframe({
  frame,
  x,
  y,
  isActive,
}: {
  frame: FilmstripFrame;
  x: number;
  y: number;
  isActive: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        rx={6}
        fill="white"
        stroke={isActive ? '#6366f1' : '#e2e8f0'}
        strokeWidth={isActive ? 2 : 1}
      />
      {frame.sections.map((sec, i) => {
        const style = STATE_FILLS[sec.state];
        const sy = y + 8 + i * (SECTION_HEIGHT + SECTION_GAP);
        return (
          <g key={sec.id}>
            <rect
              x={x + 4}
              y={sy}
              width={FRAME_WIDTH - 8}
              height={SECTION_HEIGHT}
              rx={2}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={0.75}
              opacity={style.opacity}
            />
            {sec.state === 'skeleton' && (
              <>
                <rect x={x + 8} y={sy + 4} width={FRAME_WIDTH * 0.5} height={3} rx={1} fill="#cbd5e1" opacity={0.6} />
                <rect x={x + 8} y={sy + 9} width={FRAME_WIDTH * 0.3} height={3} rx={1} fill="#cbd5e1" opacity={0.4} />
              </>
            )}
            <text
              x={x + FRAME_WIDTH / 2}
              y={sy + SECTION_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={sec.state === 'interactive' ? 'white' : sec.state === 'skeleton' ? 'transparent' : '#64748b'}
              fontSize={7}
            >
              {sec.state !== 'skeleton' && (sec.label.length > 14 ? sec.label.slice(0, 12) + '..' : sec.label)}
            </text>
          </g>
        );
      })}
      <text
        x={x + FRAME_WIDTH / 2}
        y={y + FRAME_HEIGHT + 12}
        textAnchor="middle"
        className="text-[9px]"
        fill="#94a3b8"
      >
        {frame.timeMs >= 1000 ? `${(frame.timeMs / 1000).toFixed(1)}s` : `${Math.round(frame.timeMs)}ms`}
      </text>
    </g>
  );
}

function FrameRow({
  label,
  frames,
  y,
  playheadMs,
  maxDurationMs,
}: {
  label: string;
  frames: FilmstripFrame[];
  y: number;
  playheadMs: number;
  maxDurationMs: number;
}) {
  const activeIdx = frames.reduce((best, frame, i) => (frame.timeMs <= playheadMs ? i : best), 0);

  return (
    <g>
      <text x={PADDING_X} y={y - 6} className="text-[11px] font-semibold" fill="#334155">
        {label}
      </text>
      {frames.map((frame, i) => (
        <PageWireframe
          key={i}
          frame={frame}
          x={PADDING_X + LABEL_WIDTH + i * (FRAME_WIDTH + FRAME_GAP)}
          y={y}
          isActive={i === activeIdx}
        />
      ))}
      <g>
        <rect
          x={PADDING_X + LABEL_WIDTH}
          y={y + FRAME_HEIGHT + 22}
          width={frames.length * (FRAME_WIDTH + FRAME_GAP) - FRAME_GAP}
          height={TIMELINE_HEIGHT}
          rx={4}
          fill="#f1f5f9"
        />
        {maxDurationMs > 0 && (
          <rect
            x={PADDING_X + LABEL_WIDTH}
            y={y + FRAME_HEIGHT + 22}
            width={
              Math.min(1, playheadMs / maxDurationMs) *
              (frames.length * (FRAME_WIDTH + FRAME_GAP) - FRAME_GAP)
            }
            height={TIMELINE_HEIGHT}
            rx={4}
            fill="#6366f1"
            opacity={0.6}
          />
        )}
      </g>
    </g>
  );
}

export default function FilmstripSvg({ ssrFrames, rscFrames, playheadMs, maxDurationMs }: FilmstripSvgProps) {
  const frameCount = Math.max(ssrFrames.length, rscFrames.length);
  const rowWidth = PADDING_X + LABEL_WIDTH + frameCount * (FRAME_WIDTH + FRAME_GAP) + PADDING_X;
  const ssrRowY = 10;
  const rscRowY = ssrRowY + FRAME_HEIGHT + 22 + TIMELINE_HEIGHT + ROW_GAP + 20;
  const svgHeight = rscRowY + FRAME_HEIGHT + 22 + TIMELINE_HEIGHT + 16;

  return (
    <svg
      viewBox={`0 0 ${rowWidth} ${svgHeight}`}
      className="w-full"
      role="img"
      aria-label="Restaurant page filmstrip: SSR vs RSC"
    >
      <FrameRow label="SSR" frames={ssrFrames} y={ssrRowY} playheadMs={playheadMs} maxDurationMs={maxDurationMs} />
      <FrameRow label="RSC" frames={rscFrames} y={rscRowY} playheadMs={playheadMs} maxDurationMs={maxDurationMs} />

      <g transform={`translate(${rowWidth - 260}, ${svgHeight - 14})`}>
        {([
          { state: 'blank' as const, label: 'Not loaded' },
          { state: 'skeleton' as const, label: 'Skeleton' },
          { state: 'content' as const, label: 'Visible' },
          { state: 'interactive' as const, label: 'Interactive' },
        ]).map((item, i) => {
          const style = STATE_FILLS[item.state];
          return (
            <g key={item.state} transform={`translate(${i * 65}, 0)`}>
              <rect
                x={0}
                y={-5}
                width={10}
                height={10}
                rx={2}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={0.75}
                opacity={style.opacity}
              />
              <text x={14} y={0} dominantBaseline="central" className="text-[8px]" fill="#94a3b8">
                {item.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

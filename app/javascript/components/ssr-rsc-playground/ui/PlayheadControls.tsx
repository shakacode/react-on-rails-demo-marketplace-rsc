'use client';

import React from 'react';

interface PlayheadControlsProps {
  isPlaying: boolean;
  playheadMs: number;
  maxDurationMs: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onScrub: (ms: number) => void;
  onRateChange: (rate: number) => void;
}

const RATES = [0.5, 1, 2, 4];

export default function PlayheadControls({
  isPlaying,
  playheadMs,
  maxDurationMs,
  playbackRate,
  onPlay,
  onPause,
  onReset,
  onScrub,
  onRateChange,
}: PlayheadControlsProps) {
  const timeLabel = playheadMs >= 1000 ? `${(playheadMs / 1000).toFixed(1)}s` : `${Math.round(playheadMs)}ms`;
  const maxLabel = maxDurationMs >= 1000 ? `${(maxDurationMs / 1000).toFixed(1)}s` : `${Math.round(maxDurationMs)}ms`;

  const btnClass =
    'inline-flex items-center justify-center h-8 px-3 rounded-full text-sm font-medium transition border';
  const primaryBtn = `${btnClass} bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 active:scale-[0.98]`;
  const secondaryBtn = `${btnClass} bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-[0.98]`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={isPlaying ? onPause : onPlay}
        className={primaryBtn}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
        <span className="ml-1.5">{isPlaying ? 'Pause' : 'Play'}</span>
      </button>

      <button onClick={onReset} className={secondaryBtn} aria-label="Reset">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1v5h5" />
          <path d="M2.5 9A5.5 5.5 0 1 0 4 4L1 6" />
        </svg>
        <span className="ml-1.5">Reset</span>
      </button>

      <div className="flex items-center gap-1 ml-1">
        {RATES.map((rate) => (
          <button
            key={rate}
            onClick={() => onRateChange(rate)}
            className={`h-7 px-2 rounded-md text-xs font-medium transition ${
              playbackRate === rate
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
            aria-label={`${rate}x speed`}
          >
            {rate}x
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-[120px] flex items-center gap-2">
        <span className="text-xs text-slate-500 tabular-nums w-12 text-right">{timeLabel}</span>
        <input
          type="range"
          min={0}
          max={maxDurationMs}
          step={1}
          value={playheadMs}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          aria-label="Timeline scrubber"
        />
        <span className="text-xs text-slate-400 tabular-nums w-12">{maxLabel}</span>
      </div>
    </div>
  );
}

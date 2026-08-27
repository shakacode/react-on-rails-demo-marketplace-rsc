// Review-card footer with a REAL "Helpful" button (issue #184). The old
// static <span> gave the vitals harness nothing to click, so the restaurant
// lanes could never record INP — Event Timing only observes discrete
// interactions (clicks/taps/keys), never scrolling. Client components import
// this directly; server components import HelpfulButtonForServer.
import React, { useState } from 'react';

interface Props {
  helpfulCount: number;
}

export function HelpfulButton({ helpfulCount }: Props) {
  const [marked, setMarked] = useState(false);

  return (
    <footer className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span>{helpfulCount + (marked ? 1 : 0)} found this helpful</span>
      <button
        type="button"
        data-benchmark-id="review-helpful"
        aria-pressed={marked}
        onClick={() => setMarked((m) => !m)}
        className={
          'inline-flex items-center gap-1 cursor-pointer transition-colors ' +
          (marked ? 'text-emerald-700 font-semibold' : 'hover:text-slate-700')
        }
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 7l5-4 5 4v6H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        {marked ? 'Marked helpful' : 'Helpful'}
      </button>
    </footer>
  );
}

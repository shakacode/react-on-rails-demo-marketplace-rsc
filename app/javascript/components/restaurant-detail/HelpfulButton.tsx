// Review-card footer with a REAL "Helpful" button (issue #184). The old
// static <span> gave the vitals harness nothing to click, so the restaurant
// lanes could never record INP — Event Timing only observes discrete
// interactions (clicks/taps/keys), never scrolling. Client components import
// this directly; server components import HelpfulButtonForServer.
import React, { useSyncExternalStore } from 'react';

interface Props {
  // Stable review id — the store key. Row-local useState would forget the
  // click on the virtualized routes: Virtuoso unmounts rows that leave the
  // window, and a remounted row starts from fresh state.
  reviewId: number;
  helpfulCount: number;
}

// Module-scoped marked-state, keyed by review id, consumed through
// useSyncExternalStore. Every HelpfulButton on a page shares this module
// instance — including the Flight-island case on /restaurant/:id/rsc-virtual,
// where each island loads the same client chunk — so the pressed state
// survives a virtualized row unmounting and remounting. Intentionally resets
// on a full page load: nothing persists server-side.
const markedReviews = new Set<number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toggleMarked(reviewId: number) {
  if (!markedReviews.delete(reviewId)) markedReviews.add(reviewId);
  listeners.forEach((listener) => listener());
}

// SSR renders every button unmarked; the store only ever changes client-side.
const getServerSnapshot = () => false;

export function HelpfulButton({ reviewId, helpfulCount }: Props) {
  const marked = useSyncExternalStore(subscribe, () => markedReviews.has(reviewId), getServerSnapshot);

  return (
    <footer className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span>{helpfulCount + (marked ? 1 : 0)} found this helpful</span>
      <button
        type="button"
        data-benchmark-id="review-helpful"
        aria-pressed={marked}
        onClick={() => toggleMarked(reviewId)}
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

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface InteractionEntry {
  timestamp: number;
  duration: number;
  target: string;
}

export function INPOverlay() {
  const [interactions, setInteractions] = useState<InteractionEntry[]>([]);
  const [worstInp, setWorstInp] = useState<number>(0);
  const [lastInp, setLastInp] = useState<number | null>(null);
  const observerRef = useRef<PerformanceObserver | null>(null);

  const getRating = useCallback((ms: number) => {
    if (ms <= 200) return { label: 'Good', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
    if (ms <= 500) return { label: 'Needs Work', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    return { label: 'Poor', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  }, []);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Event Timing API entries have 'duration' and 'processingStart'
          const eventEntry = entry as PerformanceEventTiming;
          if (eventEntry.duration == null) continue;

          const duration = eventEntry.duration;
          // Only track meaningful interactions (clicks, key presses, etc.)
          if (duration < 1) continue;

          const targetName = eventEntry.name || 'unknown';
          const newEntry: InteractionEntry = {
            timestamp: Date.now(),
            duration: Math.round(duration),
            target: targetName,
          };

          setInteractions((prev) => [...prev.slice(-4), newEntry]);
          setLastInp(Math.round(duration));
          setWorstInp((prev) => Math.max(prev, Math.round(duration)));
        }
      });

      observer.observe({ type: 'event', buffered: true, durationThreshold: 0 } as PerformanceObserverInit);
      observerRef.current = observer;
    } catch {
      // Event Timing API not supported in this browser
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const worstRating = getRating(worstInp);
  const lastRating = lastInp !== null ? getRating(lastInp) : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold">INP Monitor</span>
          </div>
          <span className="text-xs text-gray-400">Interaction to Next Paint</span>
        </div>

        {/* Metrics */}
        <div className="p-4 space-y-3">
          {/* Worst INP */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Worst INP</span>
            <div className={`flex items-center gap-2 px-2 py-0.5 rounded border ${worstRating.bg}`}>
              <span className={`text-lg font-bold tabular-nums ${worstRating.color}`}>
                {worstInp}ms
              </span>
              <span className={`text-xs font-medium ${worstRating.color}`}>
                {worstRating.label}
              </span>
            </div>
          </div>

          {/* Last Interaction */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Last</span>
            {lastRating ? (
              <span className={`text-sm font-semibold tabular-nums ${lastRating.color}`}>
                {lastInp}ms
              </span>
            ) : (
              <span className="text-sm text-gray-400">Click something...</span>
            )}
          </div>

          {/* Recent Interactions Log */}
          {interactions.length > 0 && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <span className="text-xs text-gray-400 block mb-1.5">Recent interactions</span>
              <div className="space-y-1">
                {interactions.map((entry, i) => {
                  const r = getRating(entry.duration);
                  return (
                    <div key={entry.timestamp + i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 truncate max-w-[140px]">{entry.target}</span>
                      <span className={`font-mono font-medium tabular-nums ${r.color}`}>
                        {entry.duration}ms
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thresholds Legend */}
          <div className="border-t border-gray-100 pt-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              &le;200ms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              &le;500ms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              &gt;500ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';

type ReadingMode = 'default' | 'compact' | 'dark';

const STORAGE_KEY = 'blog:reading-mode';
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const modes: { value: ReadingMode; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: 'A' },
  { value: 'compact', label: 'Compact', icon: 'A̲' },
  { value: 'dark', label: 'Dark', icon: '☽' },
];

function applyMode(mode: ReadingMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('reading-mode-default', 'reading-mode-compact', 'reading-mode-dark');
  root.classList.add(`reading-mode-${mode}`);
}

function storedMode(): ReadingMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'compact' || stored === 'dark' || stored === 'default' ? stored : 'default';
  } catch {
    return 'default';
  }
}

export function ReadingModeToggle() {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const [selectedMode, setSelectedMode] = useState<ReadingMode | null>(null);
  const mode = selectedMode ?? (hydrated ? storedMode() : 'default');

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  useEffect(() => {
    return () => applyMode('default');
  }, []);

  const handleSelect = (next: ReadingMode) => {
    setSelectedMode(next);
    applyMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / private mode failures
    }
  };

  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-xs text-gray-500 mr-1">Reading mode:</span>
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => handleSelect(m.value)}
          aria-pressed={mode === m.value}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
            mode === m.value
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span className="mr-1">{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

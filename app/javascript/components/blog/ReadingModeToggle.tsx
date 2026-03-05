import React, { useState } from 'react';

type ReadingMode = 'default' | 'compact' | 'dark';

const modes: { value: ReadingMode; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: 'A' },
  { value: 'compact', label: 'Compact', icon: 'A\u0332' },
  { value: 'dark', label: 'Dark', icon: '\u263d' },
];

export function ReadingModeToggle() {
  const [mode, setMode] = useState<ReadingMode>('default');

  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-xs text-gray-500 mr-1">Reading mode:</span>
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
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

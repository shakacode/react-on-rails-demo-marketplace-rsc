import React, { useState } from 'react';

interface TocEntry {
  id: string;
  title: string;
  level: number;
}

interface Props {
  entries: TocEntry[];
}

export function TableOfContents({ entries }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleEntryClick = (id: string) => {
    setActiveId(id);
    setExpanded(false);
  };

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h12" />
        </svg>
        Table of Contents ({entries.length} sections)
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <nav className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => handleEntryClick(entry.id)}
                  className={`block w-full text-left text-sm py-1 px-2 rounded transition-colors ${
                    entry.level > 2 ? 'ml-4' : ''
                  } ${
                    activeId === entry.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

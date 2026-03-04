import React from 'react';

interface Filter {
  type: string;
  value: string;
  label: string;
}

interface Props {
  filters: Filter[];
  onRemoveFilter: (type: string) => void;
  onClearAll: () => void;
}

export function ActiveFilterPills({ filters, onRemoveFilter, onClearAll }: Props) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs text-gray-500 font-medium">Active filters:</span>
      {filters.map((filter) => (
        <button
          key={filter.type}
          onClick={() => onRemoveFilter(filter.type)}
          className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-100 transition-colors group"
        >
          <span className="text-indigo-400 text-xs">{filter.label}:</span>
          {filter.value}
          <svg className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

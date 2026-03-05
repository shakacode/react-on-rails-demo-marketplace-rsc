import React from 'react';

interface Props {
  currentSort: string;
  totalResults: number;
  onSortChange: (sort: string) => void;
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
];

export function SortBar({ currentSort, totalResults, onSortChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-1">
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{totalResults.toLocaleString()}</span>{' '}
        results
      </p>
      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-sm text-gray-500 whitespace-nowrap">
          Sort by:
        </label>
        <select
          id="sort-select"
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

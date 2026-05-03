'use client';

import React, { useCallback, useState } from 'react';

interface Props {
  initialQuery?: string;
}

function navigateWithQuery(q: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (q.trim()) {
    url.searchParams.set('q', q.trim());
  } else {
    url.searchParams.delete('q');
  }
  window.location.assign(url.pathname + (url.search ? url.search : ''));
}

export function RestaurantSearchBar({ initialQuery = '' }: Props) {
  const [value, setValue] = useState(initialQuery);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigateWithQuery(value);
    },
    [value]
  );

  const handleClear = useCallback(() => {
    setValue('');
    navigateWithQuery('');
  }, []);

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name, cuisine, or city..."
        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <button
        type="submit"
        className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
      >
        Search
      </button>
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          Clear
        </button>
      )}
    </form>
  );
}

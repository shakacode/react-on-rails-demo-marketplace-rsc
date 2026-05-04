// No 'use client' — pure server component. Status pills are <a> links,
// period selector lives in <DashboardRangePicker>. Each click reloads the
// page with a new ?status=... param so the controller re-runs queries
// scoped to that status. Zero client JS shipped.

import React from 'react';

interface DashboardFiltersProps {
  statuses: string[];
  range: string;
  status?: string | null;
}

function buildHref(params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) search.set(key, value);
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '?';
}

export default function DashboardFilters({ statuses, range, status }: DashboardFiltersProps) {
  return (
    <div data-dashboard-filters className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-500 mr-1">Status:</span>
        <a
          href={buildHref({ range })}
          aria-current={!status ? 'page' : undefined}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            !status ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </a>
        {statuses.map((s) => {
          const active = status === s;
          return (
            <a
              key={s}
              href={buildHref({ range, status: s })}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </a>
          );
        })}
      </div>
    </div>
  );
}

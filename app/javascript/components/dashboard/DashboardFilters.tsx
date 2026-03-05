import React, { useState, useEffect, useCallback } from 'react';

interface DashboardFiltersProps {
  statuses: string[];
  onStatusFilter?: (status: string | null) => void;
  onTimeRange?: (range: string) => void;
}

const TIME_RANGES = [
  { label: '7d', value: '7d' },
  { label: '14d', value: '14d' },
  { label: '30d', value: '30d' },
];

export default function DashboardFilters({ statuses, onStatusFilter, onTimeRange }: DashboardFiltersProps) {
  const [activeRange, setActiveRange] = useState('7d');
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  // Mark as hydrated for TTI measurement
  useEffect(() => {
    const el = document.querySelector('[data-dashboard-filters]');
    if (el) el.setAttribute('data-hydrated', 'true');
  }, []);

  const handleRangeClick = useCallback((range: string) => {
    setActiveRange(range);
    onTimeRange?.(range);
  }, [onTimeRange]);

  const handleStatusClick = useCallback((status: string | null) => {
    setActiveStatus(status);
    onStatusFilter?.(status);
  }, [onStatusFilter]);

  return (
    <div data-dashboard-filters className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Time Range Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">Period:</span>
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleRangeClick(value)}
              data-filter-btn="time"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeRange === value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">Status:</span>
          <button
            onClick={() => handleStatusClick(null)}
            data-filter-btn="status"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeStatus === null
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusClick(status)}
              data-filter-btn="status"
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                activeStatus === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

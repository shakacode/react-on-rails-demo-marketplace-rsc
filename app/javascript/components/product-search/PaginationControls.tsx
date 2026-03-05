import React from 'react';
import type { Pagination } from './types';

interface Props {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ pagination, onPageChange }: Props) {
  const { current_page, total_pages } = pagination;

  if (total_pages <= 1) return null;

  const pages = getPageNumbers(current_page, total_pages);

  return (
    <nav className="flex items-center justify-center gap-1 mt-8 py-4">
      <button
        onClick={() => onPageChange(current_page - 1)}
        disabled={current_page === 1}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Prev
      </button>

      {pages.map((page, i) => (
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              current_page === page
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        )
      ))}

      <button
        onClick={() => onPageChange(current_page + 1)}
        disabled={current_page === total_pages}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}

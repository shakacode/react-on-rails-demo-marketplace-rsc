'use client';

// SearchShell — client component wrappers for all interactive elements in RSC.
// Product result cards are rendered as server components (zero JS).
// Each wrapper is a separate client component island that hydrates independently.

import React, { useState, useCallback } from 'react';
import { SearchInput } from './SearchInput';
import { SortBar } from './SortBar';
import { FilterSidebar } from './FilterSidebar';
import { FilterSidebarSkeleton } from './SearchSkeletons';
import { PaginationControls } from './PaginationControls';
import { ActiveFilterPills } from './ActiveFilterPills';
import type { Facets, Pagination } from './types';

interface BrandHighlight {
  name: string;
  product_count: number;
  avg_rating: number;
}

interface PopularTag {
  name: string;
  count: number;
}

interface SearchShellHeaderProps {
  initialQuery: string;
}

// Client-side search bar wrapper
export function SearchShellHeader({ initialQuery }: SearchShellHeaderProps) {
  const handleSearch = useCallback((query: string) => {
    // In a real app, this would update URL params
  }, []);

  return (
    <SearchInput initialQuery={initialQuery} onSearch={handleSearch} />
  );
}

interface SearchShellSortProps {
  currentSort: string;
  totalResults: number;
}

// Client-side sort bar wrapper
export function SearchShellSort({ currentSort, totalResults }: SearchShellSortProps) {
  const [sort, setSort] = useState(currentSort);

  return (
    <SortBar currentSort={sort} totalResults={totalResults} onSortChange={setSort} />
  );
}

interface SearchShellFiltersProps {
  facets: Facets;
}

// Client-side filter sidebar wrapper
export function SearchShellFilters({ facets }: SearchShellFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string | undefined>>({});

  const handleFilterChange = useCallback((filters: Record<string, string | undefined>) => {
    setActiveFilters(filters);
  }, []);

  return (
    <FilterSidebar
      facets={facets}
      activeFilters={activeFilters}
      onFilterChange={handleFilterChange}
    />
  );
}

interface SearchShellPaginationProps {
  pagination: Pagination;
}

// Client-side pagination wrapper
export function SearchShellPagination({ pagination }: SearchShellPaginationProps) {
  const handlePageChange = useCallback((page: number) => {
    // In a real app, this would update URL params
  }, []);

  return (
    <PaginationControls pagination={pagination} onPageChange={handlePageChange} />
  );
}

interface AddToCartButtonProps {
  productId: number;
  inStock: boolean;
}

// Client-side Add to Cart button — the only interactive part of a product card in RSC.
// In RSC: only this tiny component hydrates, the rest of the card is pure HTML.
// In SSR: this hydrates along with the entire card and all its rendering logic.
export function AddToCartButton({ productId, inStock }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);

  const handleClick = useCallback(() => {
    setAdded(true);
    // In a real app: dispatch to cart store / API call
    setTimeout(() => setAdded(false), 2000);
  }, []);

  if (!inStock) {
    return (
      <button
        disabled
        className="w-full mt-3 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
      >
        Out of Stock
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full mt-3 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        added
          ? 'bg-green-600 text-white'
          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
      }`}
    >
      {added ? 'Added!' : 'Add to Cart'}
    </button>
  );
}

// --- Compare button — client component island for each product card in RSC ---
// In SSR: this is part of the entire hydrated card.
// In RSC: this is an isolated client island, only this tiny button hydrates per card.

interface CompareButtonProps {
  productId: number;
}

// Global compare state shared across all CompareButton instances
const compareState = { listeners: new Set<() => void>(), selected: new Set<number>() };

function useCompareState(productId: number): [boolean, () => void] {
  const [isSelected, setIsSelected] = useState(() => compareState.selected.has(productId));

  React.useEffect(() => {
    const listener = () => setIsSelected(compareState.selected.has(productId));
    compareState.listeners.add(listener);
    return () => { compareState.listeners.delete(listener); };
  }, [productId]);

  const toggle = useCallback(() => {
    if (compareState.selected.has(productId)) {
      compareState.selected.delete(productId);
    } else if (compareState.selected.size < 4) {
      compareState.selected.add(productId);
    }
    compareState.listeners.forEach((l) => l());
  }, [productId]);

  return [isSelected, toggle];
}

export function CompareButton({ productId }: CompareButtonProps) {
  const [isSelected, toggle] = useCompareState(productId);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
        isSelected
          ? 'bg-indigo-600 text-white shadow-md'
          : 'bg-white/80 text-gray-400 hover:bg-white hover:text-gray-600 shadow-sm'
      }`}
      title="Add to compare"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isSelected ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        )}
      </svg>
    </button>
  );
}

// --- Compare bar — sticky bar showing selected count ---
export function CompareBar() {
  const [count, setCount] = useState(0);

  React.useEffect(() => {
    const listener = () => setCount(compareState.selected.size);
    compareState.listeners.add(listener);
    return () => { compareState.listeners.delete(listener); };
  }, []);

  const handleClear = useCallback(() => {
    compareState.selected.clear();
    compareState.listeners.forEach((l) => l());
  }, []);

  if (count === 0) return null;

  return (
    <div className="bg-indigo-600 text-white py-2 px-4 sticky top-[88px] z-20">
      <div className="container mx-auto max-w-7xl flex items-center justify-between">
        <span className="text-sm font-medium">
          {count} product{count > 1 ? 's' : ''} selected for comparison
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors"
          >
            Clear
          </button>
          <button className="text-xs bg-white text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full font-medium transition-colors">
            Compare Now
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Active filter pills — client component wrapper for RSC ---
interface SearchShellActiveFiltersProps {
  filtersApplied: { type: string; value: string }[];
}

export function SearchShellActiveFilters({ filtersApplied }: SearchShellActiveFiltersProps) {
  const filters = filtersApplied.map((f) => ({
    type: f.type,
    value: f.value,
    label: f.type.charAt(0).toUpperCase() + f.type.slice(1).replace('_', ' '),
  }));

  return (
    <ActiveFilterPills
      filters={filters}
      onRemoveFilter={() => {}}
      onClearAll={() => {}}
    />
  );
}

// --- Popular tags cloud — client component wrapper for RSC ---
interface SearchShellTagsProps {
  tags: PopularTag[];
}

export function SearchShellTags({ tags }: SearchShellTagsProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  if (tags.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag.name}
            onClick={() => handleTagClick(tag.name)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              selectedTags.has(tag.name)
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
            }`}
          >
            {tag.name}
            <span className="ml-1 text-gray-400">({tag.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Brand highlights — client component wrapper for RSC ---
interface SearchShellBrandHighlightsProps {
  brands: BrandHighlight[];
}

export function SearchShellBrandHighlights({ brands }: SearchShellBrandHighlightsProps) {
  if (brands.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Brands</h3>
      <div className="space-y-2">
        {brands.map((brand) => (
          <button
            key={brand.name}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{brand.name}</span>
              <span className="text-xs text-gray-400">({brand.product_count})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-xs">★</span>
              <span className="text-xs text-gray-600">{brand.avg_rating}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


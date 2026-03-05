'use client';

import React, { useState, useCallback } from 'react';
import type { Facets } from './types';
import { FilterSidebarSkeleton } from './SearchSkeletons';

interface Props {
  facets: Facets | null;
  activeFilters: {
    category?: string;
    brand?: string;
    min_rating?: string;
    in_stock?: string;
    price_min?: string;
    price_max?: string;
  };
  onFilterChange: (filters: Record<string, string | undefined>) => void;
}

export function FilterSidebar({ facets, activeFilters, onFilterChange }: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    brands: true,
    price: true,
    rating: true,
    availability: true,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    onFilterChange({
      ...activeFilters,
      category: activeFilters.category === category ? undefined : category,
    });
  }, [activeFilters, onFilterChange]);

  const handleBrandClick = useCallback((brand: string) => {
    onFilterChange({
      ...activeFilters,
      brand: activeFilters.brand === brand ? undefined : brand,
    });
  }, [activeFilters, onFilterChange]);

  const handleRatingClick = useCallback((rating: number) => {
    const current = activeFilters.min_rating;
    onFilterChange({
      ...activeFilters,
      min_rating: current === String(rating) ? undefined : String(rating),
    });
  }, [activeFilters, onFilterChange]);

  const handlePriceRangeClick = useCallback((min: number, max: number) => {
    const isActive = activeFilters.price_min === String(min) && activeFilters.price_max === String(max);
    onFilterChange({
      ...activeFilters,
      price_min: isActive ? undefined : String(min),
      price_max: isActive ? undefined : String(max),
    });
  }, [activeFilters, onFilterChange]);

  const handleStockToggle = useCallback(() => {
    onFilterChange({
      ...activeFilters,
      in_stock: activeFilters.in_stock === 'true' ? undefined : 'true',
    });
  }, [activeFilters, onFilterChange]);

  if (!facets) {
    return <FilterSidebarSkeleton />;
  }

  return (
    <aside className="w-full space-y-1">
      {/* Categories */}
      <FilterSection
        title="Category"
        isExpanded={expandedSections.categories}
        onToggle={() => toggleSection('categories')}
      >
        <div className="space-y-1">
          {facets.categories.map(([category, count]) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeFilters.category === category
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{category}</span>
              <span className={`text-xs ${activeFilters.category === category ? 'text-indigo-500' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Brands */}
      <FilterSection
        title="Brand"
        isExpanded={expandedSections.brands}
        onToggle={() => toggleSection('brands')}
      >
        <div className="space-y-1">
          {facets.brands.slice(0, 10).map(([brand, count]) => (
            <button
              key={brand}
              onClick={() => handleBrandClick(brand)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeFilters.brand === brand
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{brand}</span>
              <span className={`text-xs ${activeFilters.brand === brand ? 'text-indigo-500' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Price Ranges */}
      <FilterSection
        title="Price"
        isExpanded={expandedSections.price}
        onToggle={() => toggleSection('price')}
      >
        <div className="space-y-1">
          {facets.price_ranges.map((range) => {
            const isActive = activeFilters.price_min === String(range.min) && activeFilters.price_max === String(range.max);
            return (
              <button
                key={range.label}
                onClick={() => handlePriceRangeClick(range.min, range.max)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{range.label}</span>
                <span className={`text-xs ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                  {range.count}
                </span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection
        title="Customer Rating"
        isExpanded={expandedSections.rating}
        onToggle={() => toggleSection('rating')}
      >
        <div className="space-y-1">
          {[4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => handleRatingClick(stars)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeFilters.min_rating === String(stars)
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="text-amber-400">{'★'.repeat(stars)}</span>
                <span className="text-gray-400">{'★'.repeat(5 - stars)}</span>
                <span className="text-xs ml-1">& Up</span>
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Availability */}
      <FilterSection
        title="Availability"
        isExpanded={expandedSections.availability}
        onToggle={() => toggleSection('availability')}
      >
        <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={activeFilters.in_stock === 'true'}
            onChange={handleStockToggle}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">In Stock Only</span>
          <span className="text-xs text-gray-400 ml-auto">{facets.in_stock_count}</span>
        </label>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 pb-3 mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-900"
      >
        {title}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && <div className="mt-1">{children}</div>}
    </div>
  );
}


import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { TopMenuItem } from '../../types/dashboard';

interface InteractiveTopItemsProps {
  items: TopMenuItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Appetizers: '#f59e0b',
  Entrees: '#6366f1',
  Desserts: '#ec4899',
  Drinks: '#06b6d4',
  Sides: '#22c55e',
  Specials: '#8b5cf6',
};

export default function InteractiveTopItems({ items }: InteractiveTopItemsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Mark as hydrated for TTI measurement
  useEffect(() => {
    const el = document.querySelector('[data-interactive-items]');
    if (el) el.setAttribute('data-hydrated', 'true');
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category))];
    return cats.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter(i => i.category === activeCategory);
  }, [items, activeCategory]);

  const maxRevenue = useMemo(() => {
    return Math.max(...filteredItems.map(i => i.total_revenue), 1);
  }, [filteredItems]);

  const handleCategoryClick = useCallback((cat: string | null) => {
    setActiveCategory(cat);
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div data-interactive-items className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Top Menu Items</h3>
        <span className="text-sm text-gray-500">By revenue (30 days)</span>
      </div>

      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleCategoryClick(null)}
          data-category-btn="all"
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            activeCategory === null
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({items.length})
        </button>
        {categories.map((cat) => {
          const count = items.filter(i => i.category === cat).length;
          const color = CATEGORY_COLORS[cat] || '#6366f1';
          return (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              data-category-btn={cat}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeCategory === cat
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={activeCategory === cat ? { backgroundColor: color } : undefined}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Horizontal bar chart — no d3, pure CSS widths */}
      <div className="space-y-2">
        {filteredItems.map((item, i) => {
          const pct = (item.total_revenue / maxRevenue) * 100;
          const color = CATEGORY_COLORS[item.category] || '#6366f1';
          return (
            <div key={item.name + i} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-40 truncate text-right flex-shrink-0">
                {item.name}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-16 text-right flex-shrink-0">
                ${Math.round(item.total_revenue).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

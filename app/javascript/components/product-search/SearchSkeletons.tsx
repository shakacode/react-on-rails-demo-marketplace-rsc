import React from 'react';

export function ResultsGridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Sort bar skeleton */}
      <div className="flex items-center justify-between py-3 px-1 mb-4">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-8 w-40 bg-gray-200 rounded-lg" />
      </div>
      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="aspect-square bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="flex gap-1">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-gray-200 rounded" />
          <div className="h-3 w-5/6 bg-gray-200 rounded" />
          <div className="h-3 w-4/6 bg-gray-200 rounded" />
        </div>
        <div className="pt-2 border-t border-gray-100">
          <div className="h-5 w-20 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function FilterSidebarSkeleton() {
  return (
    <aside className="w-full space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border-b border-gray-100 pb-3">
          <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between px-3">
                <div className="h-3 bg-gray-200 rounded" style={{ width: `${50 + j * 15}px` }} />
                <div className="h-3 w-6 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

export function ReviewSnippetsSkeleton() {
  return (
    <div className="animate-pulse space-y-3 mt-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
          <div className="h-3 w-32 bg-amber-200 rounded mb-2" />
          <div className="h-3 w-full bg-amber-100 rounded" />
        </div>
      ))}
    </div>
  );
}

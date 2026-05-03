'use client';

// V2: Client Components — Shell renders immediately, heavy data fetched client-side.
// d3 + date-fns loaded in main bundle (or async chunk).
// Multiple API round-trips needed for each data section.

import React from 'react';
import loadable from '@loadable/component';
import type { DashboardRestaurant } from '../../types/dashboard';
import DashboardHeader from './DashboardHeader';
import { StatCardsSkeleton, ChartSkeleton, TableSkeleton, TopItemsSkeleton } from './DashboardSkeletons';

const AsyncDashboardContent = loadable(
  () => import(/* webpackChunkName: "dashboard-async" */ './AsyncDashboardContent'),
  {
    fallback: (
      <div className="space-y-6">
        <StatCardsSkeleton />
        <ChartSkeleton title="Loading revenue chart..." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton title="Loading status chart..." height="h-60" />
          <ChartSkeleton title="Loading hourly chart..." height="h-60" />
        </div>
        <TableSkeleton />
        <TopItemsSkeleton />
      </div>
    ),
  },
);

interface Props {
  restaurant: DashboardRestaurant;
}

export default function DashboardPageClient({ restaurant }: Props) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Version indicator */}
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6">
          V2: Client Rendering — <code className="bg-white/60 px-1 rounded">@loadable/component</code> loads <code className="bg-white/60 px-1 rounded">AsyncDashboardContent</code> (d3 + date-fns ~115KB) in a deferred chunk; widgets then fetch data via 6 API calls.
        </p>

        <DashboardHeader restaurant={restaurant} />

        <AsyncDashboardContent restaurant={restaurant} />

      </div>
    </div>
  );
}

// No 'use client' — this is a server component (RSC bundle).
//
// V3: RSC Streaming — Shell streams immediately, each data section streams independently.
//
// Chart libraries stay SERVER-SIDE (zero shipped to browser):
//   - d3-scale, d3-shape, d3-array, d3-time-format (~80KB) — chart rendering
//   - d3-format (~5KB) — number formatting
//   - date-fns (~30KB) — date formatting
//   - RevenueChart, OrderStatusChart, HourlyChart, StatCards — server components
//
// Interactive 'use client' islands (small, fast to hydrate):
//   - DashboardFilters (~3KB) — time range + status filter buttons
//   - SortableOrdersTable (~4KB) — click-to-sort columns
//   - InteractiveTopItems (~3KB) — category filter buttons
//
// Total client JS: ~12KB interactive components vs ~120KB+ for SSR/Client (d3+date-fns+components)
// Plus: streaming means shell appears in <50ms instead of waiting for ALL queries.

import React, { Suspense } from 'react';
import type { DashboardRestaurant } from '../../types/dashboard';
import DashboardHeader from './DashboardHeader';
import DashboardFilters from './DashboardFiltersForServer';
import AsyncKpiStatsRSC from './AsyncKpiStatsRSC';
import AsyncRevenueChartRSC from './AsyncRevenueChartRSC';
import AsyncOrderStatusRSC from './AsyncOrderStatusRSC';
import AsyncHourlyChartRSC from './AsyncHourlyChartRSC';
import AsyncRecentOrdersRSC from './AsyncRecentOrdersRSC';
import AsyncTopItemsRSC from './AsyncTopItemsRSC';
import { StatCardsSkeleton, ChartSkeleton, TableSkeleton, TopItemsSkeleton } from './DashboardSkeletons';
import { DashboardRangePicker } from './DashboardRangePicker';

interface Props {
  restaurant: DashboardRestaurant;
  range?: string;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default function DashboardPageRSC({ restaurant, range = '7d', getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Version indicator */}
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-6">
          V3: RSC Streaming — d3 charting + date-fns stay server-side. Only ~12KB of interactive components (sort, filter) shipped to client.
        </p>

        {/* Header — renders IMMEDIATELY (no data dependencies) */}
        <DashboardHeader restaurant={restaurant} />

        {/* Range picker — pure server-rendered HTML anchors (zero JS shipped) */}
        <DashboardRangePicker range={range} />

        {/* Interactive filters — 'use client' island, hydrates fast (~3KB) */}
        <DashboardFilters
          statuses={['completed', 'preparing', 'pending', 'ready']}
        />

        {/* KPI Stats — streams first (simple aggregation queries) */}
        <div className="mb-6">
          <Suspense fallback={<StatCardsSkeleton />}>
            <AsyncKpiStatsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
        </div>

        {/* Revenue Chart — streams as time-series aggregation completes */}
        <div className="mb-6">
          <Suspense fallback={<ChartSkeleton title="Loading revenue chart..." />}>
            <AsyncRevenueChartRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
        </div>

        {/* Two-column: Order Status + Hourly Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Suspense fallback={<ChartSkeleton title="Loading status chart..." height="h-60" />}>
            <AsyncOrderStatusRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton title="Loading hourly chart..." height="h-60" />}>
            <AsyncHourlyChartRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
        </div>

        {/* Recent Orders — interactive sortable table ('use client' island) */}
        <div className="mb-6">
          <Suspense fallback={<TableSkeleton />}>
            <AsyncRecentOrdersRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
        </div>

        {/* Top Menu Items — interactive category filter ('use client' island) */}
        <div className="mb-6">
          <Suspense fallback={<TopItemsSkeleton />}>
            <AsyncTopItemsRSC getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
          </Suspense>
        </div>

      </div>
    </div>
  );
}

'use client';

// V1: Full Server SSR — ALL data fetched on server, entire page rendered at once.
// All queries must complete before ANY HTML is sent to the browser.
//
// Libraries shipped to client (for hydration):
//   - d3-scale, d3-shape, d3-array, d3-time-format (~80KB)
//   - d3-format (~5KB)
//   - date-fns (~30KB)
//   - All chart + table + interactive component code
//
// Total extra JS: ~120KB+ sent to client for hydration.
// Interactivity (sort, filter) only works after hydration completes.

import React, { useMemo } from 'react';
import type {
  DashboardRestaurant,
  KpiStats,
  RevenueDataPoint,
  OrderStatusItem,
  RecentOrder,
  TopMenuItem,
  HourlyDataPoint,
} from '../../types/dashboard';
import DashboardHeader from './DashboardHeader';
import StatCards from './StatCards';
import RevenueChart from './RevenueChart';
import OrderStatusChart from './OrderStatusChart';
import HourlyChart from './HourlyChart';
import DashboardFilters from './DashboardFilters';
import SortableOrdersTable from './SortableOrdersTable';
import InteractiveTopItems from './InteractiveTopItems';
import { DashboardRangePicker } from './DashboardRangePicker';

interface Props {
  restaurant: DashboardRestaurant;
  kpi_stats: KpiStats;
  revenue_data: RevenueDataPoint[];
  order_status: OrderStatusItem[];
  recent_orders: RecentOrder[];
  top_items: TopMenuItem[];
  hourly_data: HourlyDataPoint[];
  range?: string;
  status?: string | null;
}

export default function DashboardPageSSR({
  restaurant,
  kpi_stats,
  revenue_data,
  order_status,
  recent_orders,
  top_items,
  hourly_data,
  range = '7d',
  status = null,
}: Props) {
  const statuses = useMemo(() => ['completed', 'preparing', 'pending', 'ready'], []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Version indicator */}
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
          V1: Full SSR — All data fetched server-side before any HTML is sent. d3 + date-fns + interactive components shipped to client for hydration (~120KB+).
        </p>

        <DashboardHeader restaurant={restaurant} />

        <DashboardRangePicker range={range} />

        <DashboardFilters statuses={statuses} range={range} status={status} />

        <div className="mb-6">
          <StatCards stats={kpi_stats} />
        </div>

        <div className="mb-6">
          <RevenueChart data={revenue_data} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <OrderStatusChart data={order_status} />
          <HourlyChart data={hourly_data} />
        </div>

        <div className="mb-6">
          <SortableOrdersTable orders={recent_orders} statusFilter={null} />
        </div>

        <div className="mb-6">
          <InteractiveTopItems items={top_items} />
        </div>

      </div>
    </div>
  );
}

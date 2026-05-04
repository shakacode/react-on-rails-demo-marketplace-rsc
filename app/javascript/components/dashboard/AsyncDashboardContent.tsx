'use client';

// Client-side data fetcher — loads all dashboard data via API calls
// d3 + date-fns + interactive components are loaded as part of this async chunk

import React, { useEffect, useState, useCallback } from 'react';
import type {
  DashboardRestaurant,
  KpiStats,
  RevenueDataPoint,
  OrderStatusItem,
  RecentOrder,
  TopMenuItem,
  HourlyDataPoint,
} from '../../types/dashboard';
import StatCards from './StatCards';
import RevenueChart from './RevenueChart';
import OrderStatusChart from './OrderStatusChart';
import HourlyChart from './HourlyChart';
import DashboardFilters from './DashboardFilters';
import SortableOrdersTable from './SortableOrdersTable';
import InteractiveTopItems from './InteractiveTopItems';
import { StatCardsSkeleton, ChartSkeleton, TableSkeleton, TopItemsSkeleton } from './DashboardSkeletons';

interface Props {
  restaurant: DashboardRestaurant;
  range?: string;
  status?: string | null;
}

interface DashboardData {
  kpiStats: KpiStats | null;
  revenueData: RevenueDataPoint[] | null;
  orderStatus: OrderStatusItem[] | null;
  recentOrders: RecentOrder[] | null;
  topItems: TopMenuItem[] | null;
  hourlyData: HourlyDataPoint[] | null;
}

export default function AsyncDashboardContent({ restaurant, range = '7d', status = null }: Props) {
  const [data, setData] = useState<DashboardData>({
    kpiStats: null,
    revenueData: null,
    orderStatus: null,
    recentOrders: null,
    topItems: null,
    hourlyData: null,
  });

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    const base = '/api/dashboard';

    // Fetch all data in parallel
    const [kpiRes, revenueRes, statusRes, ordersRes, itemsRes, hourlyRes] = await Promise.all([
      fetch(`${base}/kpi_stats`, opts),
      fetch(`${base}/revenue_data`, opts),
      fetch(`${base}/order_status`, opts),
      fetch(`${base}/recent_orders`, opts),
      fetch(`${base}/top_menu_items`, opts),
      fetch(`${base}/hourly_distribution`, opts),
    ]);

    const [kpi, revenue, status, orders, items, hourly] = await Promise.all([
      kpiRes.json(),
      revenueRes.json(),
      statusRes.json(),
      ordersRes.json(),
      itemsRes.json(),
      hourlyRes.json(),
    ]);

    setData({
      kpiStats: kpi.stats,
      revenueData: revenue.data,
      orderStatus: status.data,
      recentOrders: orders.orders,
      topItems: items.items,
      hourlyData: hourly.data,
    });

    return () => controller.abort();
  }, [restaurant.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <DashboardFilters
        statuses={['completed', 'preparing', 'pending', 'ready']}
        range={range}
        status={status}
      />

      {data.kpiStats ? <StatCards stats={data.kpiStats} /> : <StatCardsSkeleton />}

      {data.revenueData ? (
        <RevenueChart data={data.revenueData} />
      ) : (
        <ChartSkeleton title="Loading revenue chart..." />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.orderStatus ? (
          <OrderStatusChart data={data.orderStatus} />
        ) : (
          <ChartSkeleton title="Loading status chart..." height="h-60" />
        )}
        {data.hourlyData ? (
          <HourlyChart data={data.hourlyData} />
        ) : (
          <ChartSkeleton title="Loading hourly chart..." height="h-60" />
        )}
      </div>

      {data.recentOrders ? (
        <SortableOrdersTable orders={data.recentOrders} statusFilter={null} />
      ) : (
        <TableSkeleton />
      )}

      {data.topItems ? <InteractiveTopItems items={data.topItems} /> : <TopItemsSkeleton />}
    </div>
  );
}

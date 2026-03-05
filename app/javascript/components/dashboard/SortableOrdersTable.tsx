import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { RecentOrder } from '../../types/dashboard';

interface SortableOrdersTableProps {
  orders: RecentOrder[];
  statusFilter: string | null;
}

type SortField = 'placed_at' | 'total_price' | 'status' | 'items_count';
type SortDir = 'asc' | 'desc';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  preparing: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ready: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function SortArrow({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="text-gray-300 ml-1">&#8597;</span>;
  return <span className="text-indigo-600 ml-1">{sortDir === 'asc' ? '&#9650;' : '&#9660;'}</span>;
}

export default function SortableOrdersTable({ orders, statusFilter }: SortableOrdersTableProps) {
  const [sortField, setSortField] = useState<SortField>('placed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Mark as hydrated for TTI measurement
  useEffect(() => {
    const el = document.querySelector('[data-sortable-table]');
    if (el) el.setAttribute('data-hydrated', 'true');
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const sortedOrders = useMemo(() => {
    let filtered = orders;
    if (statusFilter) {
      filtered = orders.filter(o => o.status === statusFilter);
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'placed_at':
          cmp = a.placed_at.localeCompare(b.placed_at);
          break;
        case 'total_price':
          cmp = a.total_price - b.total_price;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'items_count':
          cmp = a.items_count - b.items_count;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, sortField, sortDir, statusFilter]);

  if (!orders || orders.length === 0) return null;

  return (
    <div data-sortable-table className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          <span className="text-sm text-gray-500">
            {statusFilter ? `${sortedOrders.length} of ${orders.length}` : `${orders.length}`} orders
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-3 px-6 font-medium text-gray-500">Order</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Items</th>
              <th
                className="text-left py-3 px-4 font-medium text-gray-500 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                onClick={() => handleSort('status')}
                data-sort-header="status"
              >
                Status<SortArrow field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className="text-right py-3 px-4 font-medium text-gray-500 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                onClick={() => handleSort('total_price')}
                data-sort-header="total"
              >
                Total<SortArrow field="total_price" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
              <th
                className="text-right py-3 px-6 font-medium text-gray-500 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                onClick={() => handleSort('placed_at')}
                data-sort-header="time"
              >
                Time<SortArrow field="placed_at" sortField={sortField} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order, i) => {
              const badgeClass = STATUS_BADGE[order.status] || 'bg-gray-50 text-gray-700 border-gray-200';
              return (
                <tr key={order.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                  <td className="py-3 px-6">
                    <span className="font-mono text-xs text-gray-900">{order.order_number}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="text-gray-700 truncate max-w-[200px]">
                        {order.item_names.join(', ')}
                      </span>
                      <span className="text-xs text-gray-400">{order.items_count} items</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    ${order.total_price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs ${order.is_delivery ? 'text-blue-600' : 'text-gray-500'}`}>
                      {order.is_delivery ? 'Delivery' : 'Pickup'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right">
                    <span className="text-gray-700 text-xs">{order.placed_at.replace('T', ' ').slice(0, 16)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

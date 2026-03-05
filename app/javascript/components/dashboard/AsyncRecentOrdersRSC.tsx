// Server async component — streams recent orders data, renders interactive client table
// date-fns stays server-side → 30KB savings
// SortableOrdersTable is 'use client' — only the tiny sort/filter logic ships to browser
import React from 'react';
import SortableOrdersTable from './SortableOrdersTableForServer';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncRecentOrdersRSC({ getReactOnRailsAsyncProp }: Props) {
  const { orders } = await getReactOnRailsAsyncProp('recent_orders');
  return <SortableOrdersTable orders={orders} statusFilter={null} />;
}

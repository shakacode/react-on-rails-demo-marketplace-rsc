// Server async component — streams top items data, renders interactive client chart
// d3 format + scale stays server-side → 0KB to client
// InteractiveTopItems is 'use client' — only the tiny filter logic ships to browser
import React from 'react';
import InteractiveTopItems from './InteractiveTopItemsForServer';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncTopItemsRSC({ getReactOnRailsAsyncProp }: Props) {
  const { items } = await getReactOnRailsAsyncProp('top_items');
  return <InteractiveTopItems items={items} />;
}

'use client';

import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { loadableReady } from '@loadable/component';
import RestaurantDetailClient from '../components/restaurant-detail/RestaurantDetailClient';

const App = (props: Record<string, unknown>, _ctx: Record<string, unknown>, domNodeId: string) => {
  loadableReady(() => {
    const el = document.getElementById(domNodeId);
    if (el) hydrateRoot(el, <RestaurantDetailClient {...(props as any)} />);
  });
};

export default App;

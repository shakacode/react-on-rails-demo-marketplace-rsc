'use client';

import React from 'react';
import { Restaurant, Promotion, MenuItem } from '../../types';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { StatusBadge } from '../restaurant/StatusBadge';
import { WaitTimeBadge } from '../restaurant/WaitTimeBadge';
import { SpecialsList } from '../restaurant/SpecialsList';
import { TrendingItems } from '../restaurant/TrendingItems';
import { RestaurantSearchBar } from './RestaurantSearchBar';

interface RestaurantData extends Restaurant {
  status: 'open' | 'closed' | 'custom_hours';
  wait_time: number;
  specials: Promotion[];
  trending: MenuItem[];
}

interface Props {
  restaurant_data: RestaurantData[];
  query?: string;
}

export default function SearchPageSSR({ restaurant_data, query = '' }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Restaurant Search</h1>
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-4">
        V1: Full Server SSR — All restaurant data fetched on server sequentially
      </p>

      <RestaurantSearchBar initialQuery={query} />

      {restaurant_data.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium text-gray-800 mb-1">No restaurants match this search.</p>
          <p className="text-sm">Try a different name, cuisine, or city.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurant_data.map((restaurant) => (
          <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-4">
            <RestaurantCardHeader restaurant={restaurant} />

            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={restaurant.status} />
                <WaitTimeBadge minutes={restaurant.wait_time} />
              </div>
              <SpecialsList promotions={restaurant.specials} />
              <TrendingItems items={restaurant.trending} />
            </div>

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}

// No "use client" — this is a server component (RSC bundle)

import React, { Suspense } from 'react';
import { Restaurant } from '../../types';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { CardWidgetsSkeleton } from '../shared/CardWidgetsSkeleton';
import AsyncRestaurantWidgetsRSC from '../restaurant/AsyncRestaurantWidgetsRSC';
import { RestaurantSearchBar } from './RestaurantSearchBar';

interface Props {
  restaurants: Restaurant[];
  query?: string;
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function SearchPageRSC({ restaurants, query = '', getReactOnRailsAsyncProp }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Restaurant Search</h1>
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 mb-4">
        V3: RSC Streaming — Restaurant headers/footers stream as server HTML; widgets stream per-card from server.
      </p>

      <RestaurantSearchBar initialQuery={query} />

      {restaurants.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium text-gray-800 mb-1">No restaurants match this search.</p>
          <p className="text-sm">Try a different name, cuisine, or city.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {restaurants.map((restaurant) => (
          <div key={restaurant.id} className="bg-white rounded-lg shadow-md p-4">
            <RestaurantCardHeader restaurant={restaurant} />

            <Suspense fallback={<CardWidgetsSkeleton />}>
              <AsyncRestaurantWidgetsRSC
                restaurantId={restaurant.id}
                getReactOnRailsAsyncProp={getReactOnRailsAsyncProp}
              />
            </Suspense>

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}

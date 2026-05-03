'use client';

import React from 'react';
import loadable from '@loadable/component';
import { Restaurant } from '../../types';
import { RestaurantCardHeader } from '../restaurant/RestaurantCardHeader';
import { RestaurantCardFooter } from '../restaurant/RestaurantCardFooter';
import { CardWidgetsSkeleton } from '../shared/CardWidgetsSkeleton';
import { RestaurantSearchBar } from './RestaurantSearchBar';

const AsyncRestaurantWidgets = loadable(
  () => import('../restaurant/AsyncRestaurantWidgets'),
  { fallback: <CardWidgetsSkeleton /> }
);

interface Props {
  restaurants: Restaurant[];
  query?: string;
}

export default function SearchPageClient({ restaurants, query = '' }: Props) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Restaurant Search</h1>
      <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-6">
        V2: Client Components — <code className="bg-white/60 px-1 rounded">@loadable/component</code> loads <code className="bg-white/60 px-1 rounded">AsyncRestaurantWidgets</code> per card; each widget then fetches its own data via API.
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

            <AsyncRestaurantWidgets restaurantId={restaurant.id} />

            <RestaurantCardFooter restaurant={restaurant} />
          </div>
        ))}
      </div>
    </div>
  );
}

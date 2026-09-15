export type RailsCommand = 'clean' | 'scenarios/product_search' | 'scenarios/spike_mutations';
export interface ProductSearchScenario {
  products: number;
  categories: Record<string, number>;
  restaurant_id: number;
}
export interface SpikeMutationsScenario {
  product_id: number;
  products: number;
  product_reviews: number;
}

export function app(name: RailsCommand): Promise<unknown>;
export function appScenario(name: 'product_search'): Promise<[ProductSearchScenario]>;
export function appScenario(name: 'spike_mutations'): Promise<[SpikeMutationsScenario]>;

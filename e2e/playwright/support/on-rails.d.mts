export type RailsCommand = 'clean' | 'scenarios/product_search';
export interface ProductSearchScenario {
  products: number;
  categories: Record<string, number>;
  restaurant_id: number;
}

export function app(name: RailsCommand): Promise<unknown>;
export function appScenario(name: 'product_search'): Promise<[ProductSearchScenario]>;

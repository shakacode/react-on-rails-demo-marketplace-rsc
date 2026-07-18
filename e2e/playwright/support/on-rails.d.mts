export type RailsCommand = 'clean' | 'scenarios/product_search';

export function app(name: RailsCommand): Promise<unknown>;
export function appScenario(name: 'product_search'): Promise<unknown>;

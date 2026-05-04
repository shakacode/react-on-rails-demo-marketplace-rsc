import type { Product } from '../../types/product';

export interface Crumb {
  label: string;
  href?: string;
}

export function buildProductCrumbs(product: Pick<Product, 'name' | 'category' | 'brand'>): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];
  if (product.category) {
    crumbs.push({
      label: product.category,
      href: `/product-search/rsc?category=${encodeURIComponent(product.category)}`,
    });
  }
  if (product.brand) {
    crumbs.push({
      label: product.brand,
      href: `/product-search/rsc?brand=${encodeURIComponent(product.brand)}`,
    });
  }
  crumbs.push({ label: product.name });
  return crumbs;
}

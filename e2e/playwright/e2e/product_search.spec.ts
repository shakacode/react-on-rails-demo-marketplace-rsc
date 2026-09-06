import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

test.beforeEach(async () => {
  await appScenario('product_search');
});

test.afterEach(async () => {
  await app('clean');
});

test('searches, paginates, applies and removes a facet, and renders an empty state', async ({ page }) => {
  const initialResponse = await page.goto('/product-search/ssr');
  expect(initialResponse?.ok()).toBe(true);

  const searchInput = page.getByPlaceholder('Search products, brands, categories...');
  await searchInput.fill('E2E Search');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page).toHaveURL(/\/product-search\/ssr\?q=E2E\+Search$/);
  await expect(page.getByText('26 results')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Search Product 01' })).toBeVisible();

  await page.getByRole('button', { name: '2', exact: true }).click();

  await expect(page).toHaveURL(/\/product-search\/ssr\?q=E2E\+Search&page=2$/);
  await expect(page.getByRole('heading', { name: 'E2E Search Product 25' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Search Camera' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Search Product 01' })).toHaveCount(0);

  await page.getByRole('button', { name: /E2E Audio\s+25/ }).click();

  await expect(page).toHaveURL(/\/product-search\/ssr\?q=E2E\+Search&category=E2E\+Audio$/);
  await expect(page.getByText('25 results')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Search Product 01' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Search Camera' })).toHaveCount(0);

  await page.getByRole('button', { name: /Category:\s*E2E Audio/ }).click();

  await expect(page).toHaveURL(/\/product-search\/ssr\?q=E2E\+Search$/);
  await expect(page.getByText('26 results')).toBeVisible();

  await searchInput.fill('NoSuchMarketplaceResult');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page).toHaveURL(/\/product-search\/ssr\?q=NoSuchMarketplaceResult$/);
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
});

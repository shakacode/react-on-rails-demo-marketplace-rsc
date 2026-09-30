import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

test.beforeEach(async () => {
  await appScenario('product_search');
});

test.afterEach(async () => {
  await app('clean');
});

test('Apollo L1: server-only GraphQL renders product with reviews', async ({ page }) => {
  const response = await page.goto('/product/rsc-apollo-l1');
  expect(response?.ok()).toBe(true);

  // Version indicator
  await expect(page.getByText('Apollo L1: Server-Only GraphQL')).toBeVisible();

  // Product heading from GraphQL
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Reviews section rendered server-side from GraphQL
  await expect(page.getByText('Customer Reviews')).toBeVisible();
});

test('Apollo L2: PreloadQuery renders product with Suspense reviews section', async ({ page }) => {
  const response = await page.goto('/product/rsc-apollo-l2');
  expect(response?.ok()).toBe(true);

  // Version indicator
  await expect(page.getByText('Apollo L2: PreloadQuery')).toBeVisible();

  // Product heading
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Reviews section (may hydrate from PreloadQuery or re-fetch)
  await expect(page.getByText('Customer Reviews (Apollo L2)')).toBeVisible();
});

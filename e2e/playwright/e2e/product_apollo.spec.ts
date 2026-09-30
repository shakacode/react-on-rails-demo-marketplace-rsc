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

// L2 is flag-gated (D6/F6): the SSR transport requires a streaming ApolloProvider
// hook that React on Rails Pro does not yet expose. The route renders server
// content but the client island hydration degrades. Skipped until the upstream
// hook is available.
test.skip('Apollo L2: PreloadQuery renders product with Suspense reviews section', async ({ page }) => {
  const response = await page.goto('/product/rsc-apollo-l2');
  expect(response?.ok()).toBe(true);

  await expect(page.getByText('Apollo L2: PreloadQuery')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Customer Reviews (Apollo L2)')).toBeVisible();
});

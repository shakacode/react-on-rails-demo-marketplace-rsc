import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

test.beforeEach(async () => {
  await appScenario('product_search');
});

test.afterEach(async () => {
  await app('clean');
});

test('renders the complete SSR product journey and hydrates cart controls', async ({ page }) => {
  const response = await page.goto('/product/ssr');
  expect(response?.ok()).toBe(true);

  await expect(page.getByRole('heading', { level: 1, name: 'E2E Product Page Headphones' })).toBeVisible();
  await expect(page.getByText('SKU: E2E-PRODUCT-PAGE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Product Description' })).toBeVisible();
  await expect(page.getByText('E2E Product Page Headphones deliver deterministic sound.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top Reviews' })).toBeVisible();
  await expect(page.getByText('Excellent deterministic audio')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customers Also Viewed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Unavailable Product' })).toBeVisible();
  await expect(page.getByText('Out of stock', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Increase quantity' }).click();
  const addToCart = page.getByRole('button', { name: 'Add to Cart — $398.00' });
  await expect(addToCart).toBeVisible();
  await addToCart.click();
  await expect(page.getByRole('button', { name: 'Added to Cart' })).toBeVisible();
});

test('keeps quantity inside the available stock boundaries', async ({ page }) => {
  const response = await page.goto('/product/ssr');
  expect(response?.ok()).toBe(true);

  const decrease = page.getByRole('button', { name: 'Decrease quantity' });
  const increase = page.getByRole('button', { name: 'Increase quantity' });
  await expect(decrease).toBeDisabled();

  await increase.click();
  await increase.click();

  await expect(page.getByRole('button', { name: 'Add to Cart — $597.00' })).toBeVisible();
  await expect(increase).toBeDisabled();
});

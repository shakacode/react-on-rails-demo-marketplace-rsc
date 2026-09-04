import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

const variants = ['ssr', 'client', 'rsc'] as const;
let restaurantId: number;

test.beforeEach(async () => {
  [{ restaurant_id: restaurantId }] = await appScenario('product_search');
});

test.afterEach(async () => {
  await app('clean');
});

for (const variant of variants) {
  test(`renders the ${variant.toUpperCase()} restaurant journey`, async ({ page }) => {
    const response = await page.goto(`/restaurant/${restaurantId}/${variant}`);
    expect(response?.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'E2E Restaurant' })).toBeVisible();
    await expect(page.getByText('Pacific Rim · Honolulu, HI', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About E2E Restaurant' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Menu' })).toBeVisible();
    await expect(page.getByText('80 dishes across 7 sections', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find your way here' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Reserve a table' })).toHaveAttribute(
      'href',
      'tel:8085550146',
    );
    await page.getByRole('link', { name: 'See the menu' }).click();
    await expect(page).toHaveURL(new RegExp(`/restaurant/${restaurantId}/${variant}#menu$`));

    if (variant === 'rsc') {
      await page.getByRole('link', { name: 'Starters', exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`/restaurant/${restaurantId}/${variant}#cat-starters$`),
      );
      await expect(page.getByRole('heading', { name: /^Starters 11$/ })).toBeVisible();
    } else {
      const menuItemHeadings = page.locator('#menu').getByRole('heading', { level: 3 });
      await expect(menuItemHeadings).toHaveCount(80);
      await page.getByRole('button', { name: 'Starters', exact: true }).click();
      await expect(menuItemHeadings).toHaveCount(11);
    }
  });
}

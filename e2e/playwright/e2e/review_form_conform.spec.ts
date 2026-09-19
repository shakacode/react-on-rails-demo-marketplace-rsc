import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 2: Conform review form journey.
// The Conform form on /product/rsc uses <form action> (React 19 native),
// useFormStatus, and @conform-to/react for validation + error handling.
// It submits to the same gated POST /products/:id/reviews endpoint.

test.describe('Conform review form (Phase 2)', () => {
  test.beforeEach(async () => {
    await appScenario('spike_mutations');
  });

  test.afterEach(async () => {
    await app('clean');
  });

  test('submitting a valid review shows it after refetch', async ({ page }) => {
    const response = await page.goto('/product/rsc');
    expect(response?.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'E2E Mutation Headphones' })).toBeVisible();
    await expect(page.getByTestId('review-form-conform-island')).toBeVisible();

    const urlBefore = page.url();

    const form = page.getByTestId('review-form-conform');
    await form.locator('input[name="reviewer_name"]').fill('Conform Tester');
    await form.locator('select[name="rating"]').selectOption('4');
    await form.locator('input[name="title"]').fill('Conform review!');
    await form.locator('textarea[name="comment"]').fill('This is a test review from the Conform form.');

    await page.getByTestId('review-form-conform-submit').click();

    await expect(page.getByTestId('review-form-conform-status')).toHaveText(/posted and refetched\./, { timeout: 30_000 });

    await expect(page.locator('span.font-medium', { hasText: 'Conform Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    expect(page.url()).toBe(urlBefore);
  });

  test('submitting without required fields shows validation errors', async ({ page }) => {
    const response = await page.goto('/product/rsc');
    expect(response?.ok()).toBe(true);

    await expect(page.getByTestId('review-form-conform-island')).toBeVisible();

    const form = page.getByTestId('review-form-conform');

    await form.locator('input[name="reviewer_name"]').fill('');
    await form.locator('input[name="title"]').fill('Should persist after error');

    await page.getByTestId('review-form-conform-submit').click();

    // Conform validates client-side via parseWithZod before hitting the server.
    await expect(page.getByTestId('review-form-conform-error-reviewer_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-form-conform-error-reviewer_name')).toHaveText(/can't be blank/);

    // Conform preserves field values via lastResult — no formKey needed.
    await expect(form.locator('input[name="title"]')).toHaveValue('Should persist after error');
  });
});

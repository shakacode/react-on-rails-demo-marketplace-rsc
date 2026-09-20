import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 2: Conform review form journey.
// The Conform form on /product/rsc uses <form action> (React 19 native),
// useFormStatus, @conform-to/react + @conform-to/zod/v4 for validation + error
// handling. It submits to the same gated POST /products/:id/reviews endpoint.
//
// Key: @conform-to/zod ships a /v4 subpath for zod v4 compatibility. The
// default export targets zod v3 and breaks with v4.

test.describe('Conform review form (Phase 2)', () => {
  test.beforeEach(async () => {
    await appScenario('spike_mutations');
  });

  test.afterEach(async () => {
    await app('clean');
  });

  test('submitting a valid review shows it after refetch', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
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

    // The reviewer appears in the server-rendered review list after refetch.
    await expect(page.locator('span.font-medium', { hasText: 'Conform Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Read your writes without navigating: same URL, no reload.
    expect(page.url()).toBe(urlBefore);
  });

  test('submitting without required fields shows validation errors', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
    expect(response?.ok()).toBe(true);

    await expect(page.getByTestId('review-form-conform-island')).toBeVisible();

    const form = page.getByTestId('review-form-conform');

    await form.locator('input[name="reviewer_name"]').fill('');
    await form.locator('input[name="title"]').fill('Should persist after error');

    await page.getByTestId('review-form-conform-submit').click();

    // Conform validates client-side via parseWithZod. zod v4 may report either
    // "can't be blank" (from min(1)) or "expected string, received undefined"
    // depending on whether the empty field sends "" or is absent from FormData.
    await expect(page.getByTestId('review-form-conform-error-reviewer_name')).toBeVisible({ timeout: 15_000 });

    // Conform preserves field values via lastResult + submission.reply() —
    // no formKey remount needed. The title field keeps the user's text.
    await expect(form.locator('input[name="title"]')).toHaveValue('Should persist after error');
  });
});

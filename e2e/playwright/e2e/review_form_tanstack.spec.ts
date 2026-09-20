import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 2: TanStack Form review form journey.
// The TanStack form on /product/rsc uses onSubmit (NOT <form action>), so it
// cannot use useFormStatus. It uses TanStack's own isSubmitting flag and
// controlled inputs via form.Field render props. Server errors are tracked in
// a separate useState (not setFieldMeta, which has known bugs).

test.describe('TanStack Form review form (Phase 2)', () => {
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
    await expect(page.getByTestId('review-form-tanstack-island')).toBeVisible();

    const urlBefore = page.url();

    const form = page.getByTestId('review-form-tanstack');
    await form.locator('input[name="reviewer_name"]').fill('TanStack Tester');
    await form.locator('select[name="rating"]').selectOption('4');
    await form.locator('input[name="title"]').fill('TanStack review!');
    await form.locator('textarea[name="comment"]').fill('This is a test review from the TanStack Form form.');

    await page.getByTestId('review-form-tanstack-submit').click();

    await expect(page.getByTestId('review-form-tanstack-status')).toHaveText(/posted and refetched\./, { timeout: 30_000 });

    await expect(page.locator('span.font-medium', { hasText: 'TanStack Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    expect(page.url()).toBe(urlBefore);
  });

  test('submitting without required fields shows validation errors', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
    expect(response?.ok()).toBe(true);

    await expect(page.getByTestId('review-form-tanstack-island')).toBeVisible();

    const form = page.getByTestId('review-form-tanstack');

    // Clear the name field (TanStack uses controlled inputs).
    await form.locator('input[name="reviewer_name"]').fill('');
    await form.locator('input[name="title"]').fill('Should persist after error');

    await page.getByTestId('review-form-tanstack-submit').click();

    // TanStack validates client-side via zod before hitting the server.
    await expect(page.getByTestId('review-form-tanstack-error-reviewer_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-form-tanstack-error-reviewer_name')).toHaveText(/can't be blank/);

    // TanStack uses controlled inputs — field values are never lost.
    await expect(form.locator('input[name="title"]')).toHaveValue('Should persist after error');
  });
});

import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 2: Conform review form journey.
// The Conform form on /product/rsc uses <form action> (React 19 native),
// useFormStatus, and @conform-to/react for validation + error handling.
// It submits to the same gated POST /products/:id/reviews endpoint.
//
// Known limitation: @conform-to/zod 1.21.1 is incompatible with zod v4
// (missing ZodEffects/ZodPipeline exports), so client-side validation uses
// a manual validator. Conform's lastResult + manual SubmissionResult does not
// fully preserve field values on error (the reply() method from @conform-to/zod
// is needed for that). This is an honest finding documented in the matrix.

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

    // Conform uses <form action> with useActionState, so the action awaits
    // refetch() before returning — the status text should survive. But the RSC
    // re-stream may remount the island. Check the reviewer in the list as the
    // primary assertion (the real proof of read-your-writes).
    await expect(page.locator('span.font-medium', { hasText: 'Conform Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Read your writes without navigating: same URL, no reload.
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

    // Client-side validation catches the missing name.
    await expect(page.getByTestId('review-form-conform-error-reviewer_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-form-conform-error-reviewer_name')).toHaveText(/can't be blank/);

    // Note: without @conform-to/zod's reply() mechanism, Conform's lastResult
    // with manual SubmissionResult does not fully repopulate field values after
    // the React 19 form-reset. This is an honest finding — the title field may
    // be empty. We skip the value-preservation assertion for Conform since it
    // requires the zod adapter (which needs zod v3) for full lastResult support.
  });
});

import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 1: React 19 built-ins review form journey.
// The form on /product/rsc lets users author a review with real fields,
// submits to the same gated POST /products/:id/reviews endpoint as the #245
// spike, then RSCRoute.refetch() re-streams the server-component tree so the
// new review appears with NO navigation.
//
// The form only renders when ENABLE_SPIKE_MUTATIONS=1 (wired in e2e/run-playwright).

test.describe('React 19 review form (Phase 1)', () => {
  test.beforeEach(async () => {
    await appScenario('spike_mutations');
  });

  test.afterEach(async () => {
    await app('clean');
  });

  test('submitting a valid review shows it after refetch', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
    expect(response?.ok()).toBe(true);

    // Wait for the page to render.
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Mutation Headphones' })).toBeVisible();
    await expect(page.getByTestId('review-form-island')).toBeVisible();

    const urlBefore = page.url();

    // Fill in the form.
    const form = page.getByTestId('review-form');
    await form.locator('input[name="reviewer_name"]').fill('Alice Tester');
    await form.locator('select[name="rating"]').selectOption('4');
    await form.locator('input[name="title"]').fill('Great product!');
    await form.locator('textarea[name="comment"]').fill('This is a test review from the Phase 1 form.');

    // Submit.
    await page.getByTestId('review-form-submit').click();

    // The form reports the whole write-then-refetch round trip.
    await expect(page.getByTestId('review-form-status')).toHaveText(/posted and refetched\./, { timeout: 30_000 });

    // The refetched stream renders the just-posted reviewer in the reviews
    // list — reviewer names render as span.font-medium in ReviewCard.
    await expect(page.locator('span.font-medium', { hasText: 'Alice Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Read your writes without navigating: same URL, no reload.
    expect(page.url()).toBe(urlBefore);
  });

  test('submitting without required fields shows validation errors', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
    expect(response?.ok()).toBe(true);

    await expect(page.getByTestId('review-form-island')).toBeVisible();

    const form = page.getByTestId('review-form');

    // Fill in a title so we can verify it survives the form-reset gotcha,
    // but leave reviewer_name empty (required server-side).
    await form.locator('input[name="reviewer_name"]').fill('');
    await form.locator('input[name="title"]').fill('Should persist after error');

    // Submit the empty-name form.
    await page.getByTestId('review-form-submit').click();

    // The server responds 422 and the form displays the reviewer_name error.
    await expect(page.getByTestId('review-form-error-reviewer_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-form-error-reviewer_name')).toHaveText(/can't be blank/);

    // The form-reset gotcha workaround: the title field should still have its
    // value repopulated via defaultValue (not lost to the React 19 auto-reset).
    await expect(form.locator('input[name="title"]')).toHaveValue('Should persist after error');
  });
});

import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Issue #244 Phase 2: react-hook-form + zod review form journey.
// The RHF form on /product/rsc uses onSubmit (NOT <form action>), so it
// cannot use useFormStatus. It uses RHF's own isSubmitting flag and
// controlled inputs via register(). The React #29034 form-reset gotcha
// does not apply because RHF manages form state entirely on the client.

test.describe('react-hook-form + zod review form (Phase 2)', () => {
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
    await expect(page.getByTestId('review-form-rhf-island')).toBeVisible();

    const urlBefore = page.url();

    const form = page.getByTestId('review-form-rhf');
    await form.locator('input[name="reviewer_name"]').fill('RHF Tester');
    await form.locator('select[name="rating"]').selectOption('4');
    await form.locator('input[name="title"]').fill('RHF review!');
    await form.locator('textarea[name="comment"]').fill('This is a test review from the react-hook-form form.');

    await page.getByTestId('review-form-rhf-submit').click();

    // RHF uses onSubmit (not <form action>), so refetch() remounts the island
    // via the RSC re-stream, resetting useState. The real proof of success is
    // the reviewer appearing in the server-rendered review list.
    await expect(page.locator('span.font-medium', { hasText: 'RHF Tester' }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Read your writes without navigating: same URL, no reload.
    expect(page.url()).toBe(urlBefore);
  });

  test('submitting without required fields shows validation errors', async ({ page }) => {
    const response = await page.goto('/product/rsc-forms');
    expect(response?.ok()).toBe(true);

    await expect(page.getByTestId('review-form-rhf-island')).toBeVisible();

    const form = page.getByTestId('review-form-rhf');

    // Clear the name field (RHF uses controlled inputs, so we must clear it).
    await form.locator('input[name="reviewer_name"]').fill('');
    await form.locator('input[name="title"]').fill('Should persist after error');

    await page.getByTestId('review-form-rhf-submit').click();

    // RHF validates client-side via zodResolver before hitting the server.
    await expect(page.getByTestId('review-form-rhf-error-reviewer_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-form-rhf-error-reviewer_name')).toHaveText(/can't be blank/);

    // RHF uses controlled inputs — field values are never lost.
    await expect(form.locator('input[name="title"]')).toHaveValue('Should persist after error');
  });
});

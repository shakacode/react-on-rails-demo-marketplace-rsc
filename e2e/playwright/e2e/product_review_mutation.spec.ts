import { expect, test } from '@playwright/test';

import { app, appScenario } from '../support/on-rails.mjs';

// Read-your-writes journey (issue #245): the gated mutation island on
// /product/rsc POSTs a canned review, then RSCRoute.refetch() re-streams the
// server-component tree — the new reviewer appears with NO navigation. The
// island only renders when the Rails server runs with
// ENABLE_SPIKE_MUTATIONS=1 (wired in e2e/run-playwright).

test.beforeEach(async () => {
  await appScenario('spike_mutations');
});

test.afterEach(async () => {
  await app('clean');
});

test('posting a canned review shows it through RSCRoute.refetch with no navigation', async ({ page }) => {
  const response = await page.goto('/product/rsc');
  expect(response?.ok()).toBe(true);

  await expect(page.getByRole('heading', { level: 1, name: 'E2E Mutation Headphones' })).toBeVisible();
  await expect(page.getByText('E2E Reviewer One').first()).toBeVisible();

  const urlBefore = page.url();
  await expect(page.getByTestId('review-mutation-island')).toBeVisible();
  await page.getByTestId('post-canned-review').click();

  // The island reports the whole write-then-refetch round trip.
  await expect(page.getByTestId('mutation-status')).toHaveText(/and refetched\./, { timeout: 30_000 });
  await expect(page.getByTestId('refetch-error')).toHaveCount(0);

  // The refetched stream renders the just-posted reviewer ("Spike Bot HH:MM:SS")
  // in the reviews list — reviewer names render as span.font-medium in ReviewCard.
  await expect(page.locator('span.font-medium', { hasText: /^Spike Bot \d\d:\d\d:\d\d$/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Read your writes without navigating: same URL, no reload.
  expect(page.url()).toBe(urlBefore);
});

test('section-scoped refetch (C5) updates only the nested reviews section', async ({ page }) => {
  const response = await page.goto('/product/rsc');
  expect(response?.ok()).toBe(true);

  const nested = page.getByTestId('reviews-section-route');
  await expect(nested).toBeVisible();

  const urlBefore = page.url();
  await page.getByTestId('post-canned-review-section').click();

  await expect(page.getByTestId('mutation-status-section')).toHaveText(/and refetched\./, { timeout: 30_000 });
  await expect(page.getByTestId('refetch-error-section')).toHaveCount(0);

  // The nested route re-streams review_stats + reviews: its list shows the
  // "Spike Bot Sec" reviewer...
  await expect(nested.locator('span.font-medium', { hasText: /^Spike Bot Sec \d\d:\d\d:\d\d$/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  // ...while the INLINE reviews list outside the nested route is untouched —
  // the refetch was scoped to the nearest <RSCRoute> (that is the finding).
  // Playwright has no :not-inside combinator, so compare the page-wide match
  // count with the count inside the nested container: equal counts mean every
  // "Spike Bot Sec" reviewer lives inside the nested route.
  const pageWide = await page.locator('span.font-medium', { hasText: /^Spike Bot Sec / }).count();
  const insideNested = await nested.locator('span.font-medium', { hasText: /^Spike Bot Sec / }).count();
  expect(insideNested).toBeGreaterThan(0);
  expect(pageWide).toBe(insideNested);

  expect(page.url()).toBe(urlBefore);
});

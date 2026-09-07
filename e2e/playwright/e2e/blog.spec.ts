import { expect, test } from '@playwright/test';

const variants = ['ssr', 'client', 'rsc'] as const;

for (const variant of variants) {
  test(`renders and hydrates the ${variant.toUpperCase()} blog journey`, async ({ page }) => {
    const response = await page.goto(`/blog/${variant}`);
    expect(response?.ok()).toBe(true);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Migrating to React Server Components with React on Rails',
      }),
    ).toBeVisible();
    await expect(page.getByText('ShakaCode Team', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why Migrate to RSC?' })).toBeVisible();

    await page.getByRole('button', { name: /Table of Contents/ }).click();
    const firstSection = page.getByRole('button', { name: 'Why Migrate to RSC?', exact: true });
    await expect(firstSection).toBeVisible();
    await firstSection.click();
    await expect(firstSection).toHaveCount(0);

    await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bookmarked', exact: true })).toBeVisible();

    const darkMode = page.getByRole('button', { name: /Dark$/ });
    await darkMode.click();
    await expect(darkMode).toHaveAttribute('aria-pressed', 'true');

    const comment = `Playwright exercised the ${variant.toUpperCase()} blog journey`;
    await page.getByRole('textbox', { name: 'Leave a comment' }).fill(comment);
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await expect(page.getByText('Comment posted (local-only — not persisted).')).toBeVisible();
  });
}

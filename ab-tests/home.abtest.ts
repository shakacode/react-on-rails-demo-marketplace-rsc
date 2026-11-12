import { abTest } from 'shaka-shared';

abTest('Home page', { startingPath: '/' }, async ({ page, annotate }) => {
  annotate('Wait for the home page hero to render');
  await page.waitForSelector('[data-testid="home-hero"], .hero-section, h1', { timeout: 30_000 });

  annotate('Wait for product cards to appear');
  await page.waitForSelector('[data-testid="product-card"], .product-card, .card', { timeout: 30_000 });

  annotate('Verify navigation is present');
  await page.waitForSelector('nav, [role="navigation"]', { timeout: 10_000 });
});

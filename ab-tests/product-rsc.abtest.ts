import { abTest } from 'shaka-shared';

abTest('Product page (RSC)', { startingPath: '/product/rsc' }, async ({ page, annotate }) => {
  annotate('Wait for the product page heading to render');
  await page.waitForSelector('h1', { timeout: 30_000 });

  annotate('Wait for product details section');
  await page.waitForSelector('[data-testid="product-details"], .product-details, .product-info', {
    timeout: 30_000,
  });

  annotate('Wait for related products to stream in');
  await page.waitForSelector('[data-testid="related-products"], .related-products', {
    timeout: 30_000,
  });
});

import { abTest } from 'shaka-shared';

abTest('Blog post (RSC)', { startingPath: '/blog/rsc' }, async ({ page, annotate }) => {
  annotate('Wait for the blog post title to render');
  await page.waitForSelector('h1', { timeout: 30_000 });

  annotate('Wait for the rendered markdown content');
  await page.waitForSelector('[data-testid="blog-content"], .blog-content, article', {
    timeout: 30_000,
  });

  annotate('Wait for syntax-highlighted code blocks');
  await page.waitForSelector('pre code, .hljs', { timeout: 30_000 });
});

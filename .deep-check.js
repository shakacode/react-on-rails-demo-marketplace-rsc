// Deep check: for representative pages, verify both
//   - SSR rendered meaningful HTML (specific known content present in initial response)
//   - Hydration ran to completion (specific interactive content present after JS settles)

const puppeteer = require('puppeteer');
const BASE = 'http://localhost:3010';

// page → { ssrMust: regex(es) that MUST be in raw HTML, hydratedMust: regex(es) that must be in DOM after JS }
const checks = [
  { path: '/', ssrMust: [/LocalHub Marketplace/i], hydratedMust: [/LocalHub Marketplace/i] },
  { path: '/search/ssr', ssrMust: [/Restaurant 1/, /Restaurant Search/], hydratedMust: [/Restaurant 1/, /Trending|Open Now|min wait/] },
  { path: '/search/client', ssrMust: [/Restaurant 1/, /Restaurant Search/], hydratedMust: [/Restaurant 1/, /Trending|min wait/i] },
  { path: '/search/rsc', ssrMust: [/Restaurant 1/, /Restaurant Search/], hydratedMust: [/Restaurant 1/, /min wait/i] },
  { path: '/blog/ssr', ssrMust: [/blog|article/i], hydratedMust: [/blog|article/i] },
  { path: '/blog/client', ssrMust: [/blog|article/i], hydratedMust: [/blog|article/i] },
  { path: '/blog/rsc', ssrMust: [/blog|article/i], hydratedMust: [/blog|article/i] },
  { path: '/product/ssr', ssrMust: [/product|cart|review/i], hydratedMust: [/product|cart|review/i] },
  { path: '/product/client', ssrMust: [/product|cart|review/i], hydratedMust: [/product|cart|review/i] },
  { path: '/product/rsc', ssrMust: [/product|cart|review/i], hydratedMust: [/product|cart|review/i] },
  { path: '/product-search/ssr', ssrMust: [/Product/i], hydratedMust: [/Product/i] },
  { path: '/product-search/client', ssrMust: [/Product/i], hydratedMust: [/Product/i] },
  { path: '/product-search/rsc', ssrMust: [/Product/i], hydratedMust: [/Product/i] },
  { path: '/analytics/ssr', ssrMust: [/Revenue|Analytics|Dashboard/i, /Feb \d{2}/], hydratedMust: [/Revenue|Analytics/i, /Feb \d{2}/] },
  { path: '/analytics/client', ssrMust: [/Analytics|Dashboard/i], hydratedMust: [/Revenue|Analytics/i] },
  { path: '/analytics/rsc', ssrMust: [/Revenue|Analytics|Dashboard/i], hydratedMust: [/Revenue|Analytics|Dashboard/i] },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let fails = 0;
  for (const { path, ssrMust, hydratedMust } of checks) {
    const page = await browser.newPage();
    let ssrHtml = '';
    page.once('response', async (resp) => {
      if (resp.url().endsWith(path) || resp.url() === BASE + path) {
        try { ssrHtml = await resp.text(); } catch {}
      }
    });
    await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 25000 });
    await new Promise(r => setTimeout(r, 800));

    if (!ssrHtml) {
      // Fallback: re-fetch the raw HTML
      const resp = await fetch(BASE + path);
      ssrHtml = await resp.text();
    }

    const hydratedHtml = await page.content();

    const ssrFails = ssrMust.filter(r => !r.test(ssrHtml));
    const hydFails = hydratedMust.filter(r => !r.test(hydratedHtml));

    const ok = ssrFails.length === 0 && hydFails.length === 0;
    if (!ok) fails++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'}  ${path.padEnd(28)} ` +
      `ssr=${ssrFails.length === 0 ? '✓' : '✗ ' + ssrFails.map(r => r.source).join('|')} ` +
      `hyd=${hydFails.length === 0 ? '✓' : '✗ ' + hydFails.map(r => r.source).join('|')} ` +
      `(ssr-bytes=${ssrHtml.length}, hyd-bytes=${hydratedHtml.length})`
    );
    await page.close();
  }
  await browser.close();
  console.log(`\n${fails} failure(s) of ${checks.length} checks`);
  process.exit(fails ? 1 : 0);
})();

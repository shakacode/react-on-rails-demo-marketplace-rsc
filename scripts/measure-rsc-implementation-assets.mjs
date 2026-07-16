#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5000';
const label = process.argv[2] || 'unknown';
const outputPath = process.argv[3] || `.lh-results/rsc-implementation-assets-${label}.json`;

const pages = [
  { name: 'Home RSC', path: '/rsc' },
  { name: 'Media Gallery RSC', path: '/media-gallery/rsc' },
  { name: 'Restaurant RSC', path: '/restaurant/1/rsc' },
  { name: 'Product RSC', path: '/product/rsc' },
  { name: 'Product Search RSC', path: '/product-search/rsc' },
  { name: 'Blog RSC', path: '/blog/rsc' },
  { name: 'Blog RSC Simple', path: '/blog/rsc-simple' },
  { name: 'CSS Demo One RSC Server', path: '/css-demo/one/rsc-server' },
  { name: 'CSS Demo Two RSC Server', path: '/css-demo/two/rsc-server' },
  { name: 'CSS Demo One RSC Client', path: '/css-demo/one/rsc-client' },
  { name: 'CSS Demo Two RSC Client', path: '/css-demo/two/rsc-client' },
];

function summarizeResources(resources) {
  const jsFiles = [];
  const cssFiles = [];
  let totalJsTransfer = 0;
  let totalCssTransfer = 0;
  let totalJsDecoded = 0;
  let totalCssDecoded = 0;

  for (const resource of resources.values()) {
    if (resource.status !== 200) continue;
    if (!resource.url.includes('/packs/')) continue;

    const file = resource.url.split('/').pop()?.split('?')[0] || resource.url;
    const entry = {
      file,
      transferSize: resource.transferSize || 0,
      decodedSize: resource.decodedSize || resource.transferSize || 0,
    };

    if (resource.kind === 'js') {
      jsFiles.push(entry);
      totalJsTransfer += entry.transferSize;
      totalJsDecoded += entry.decodedSize;
    } else if (resource.kind === 'css') {
      cssFiles.push(entry);
      totalCssTransfer += entry.transferSize;
      totalCssDecoded += entry.decodedSize;
    }
  }

  jsFiles.sort((left, right) => right.transferSize - left.transferSize || left.file.localeCompare(right.file));
  cssFiles.sort((left, right) => right.transferSize - left.transferSize || left.file.localeCompare(right.file));

  return {
    js: {
      totalTransfer: totalJsTransfer,
      totalDecoded: totalJsDecoded,
      fileCount: jsFiles.length,
      files: jsFiles,
    },
    css: {
      totalTransfer: totalCssTransfer,
      totalDecoded: totalCssDecoded,
      fileCount: cssFiles.length,
      files: cssFiles,
    },
    totalTransfer: totalJsTransfer + totalCssTransfer,
    totalDecoded: totalJsDecoded + totalCssDecoded,
  };
}

function classifyResource(url, mimeType) {
  if (
    mimeType?.includes('javascript') ||
    url.endsWith('.js') ||
    url.endsWith('.mjs') ||
    url.includes('.js?') ||
    url.includes('.mjs?')
  ) {
    return 'js';
  }

  if (mimeType?.includes('css') || url.endsWith('.css') || url.includes('.css?')) {
    return 'css';
  }

  return null;
}

async function measurePage(browser, pageSpec) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.clearBrowserCookies');

  const resources = new Map();

  cdp.on('Network.responseReceived', (params) => {
    const kind = classifyResource(params.response.url, params.response.mimeType);
    if (!kind) return;

    resources.set(params.requestId, {
      url: params.response.url,
      mimeType: params.response.mimeType,
      status: params.response.status,
      kind,
      transferSize: 0,
      decodedSize: 0,
    });
  });

  cdp.on('Network.dataReceived', (params) => {
    const resource = resources.get(params.requestId);
    if (!resource) return;

    resource.decodedSize += params.dataLength || 0;
    resource.transferSize += params.encodedDataLength || 0;
  });

  cdp.on('Network.loadingFinished', (params) => {
    const resource = resources.get(params.requestId);
    if (!resource) return;

    if ((params.encodedDataLength || 0) > 0) {
      resource.transferSize = params.encodedDataLength;
    }
  });

  const url = `${baseUrl}${pageSpec.path}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.close();

  return {
    name: pageSpec.name,
    path: pageSpec.path,
    url,
    ...summarizeResources(resources),
  };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const results = [];

    for (const pageSpec of pages) {
      process.stdout.write(`Measuring ${pageSpec.name}... `);
      const result = await measurePage(browser, pageSpec);
      results.push(result);
      process.stdout.write(
        `JS ${(result.js.totalTransfer / 1024).toFixed(1)} KB, CSS ${(result.css.totalTransfer / 1024).toFixed(1)} KB\n`,
      );
    }

    mkdirSync('.lh-results', { recursive: true });
    writeFileSync(
      outputPath,
      `${JSON.stringify({ label, baseUrl, measuredAt: new Date().toISOString(), pages: results }, null, 2)}\n`,
    );
    console.log(`Saved ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

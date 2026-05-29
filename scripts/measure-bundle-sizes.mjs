#!/usr/bin/env node
/**
 * Measures actual downloaded JS/CSS bundle sizes per page using headless Chrome CDP.
 * Usage: node scripts/measure-bundle-sizes.mjs [label]
 * Output: JSON file at .lh-results/bundle-sizes-<label>.json
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { createConnection } from 'net';

const LABEL = process.argv[2] || 'unknown';
const BASE = 'http://localhost:3000';
const PAGES = [
  { name: 'Product RSC',           path: '/product/rsc' },
  { name: 'Product SSR',           path: '/product/ssr' },
  { name: 'Product Client',        path: '/product/client' },
  { name: 'Product Search RSC',    path: '/product-search/rsc' },
  { name: 'Product Search SSR',    path: '/product-search/ssr' },
  { name: 'Product Search Client', path: '/product-search/client' },
  { name: 'Blog RSC',              path: '/blog/rsc' },
  { name: 'Blog SSR',              path: '/blog/ssr' },
  { name: 'Blog Client',           path: '/blog/client' },
  { name: 'Blog RSC Simple',       path: '/blog/rsc-simple' },
  { name: 'Restaurant RSC',        path: '/restaurant/1/rsc' },
  { name: 'Restaurant SSR',        path: '/restaurant/1/ssr' },
  { name: 'Restaurant Client',     path: '/restaurant/1/client' },
];

const CDP_PORT = 9222 + Math.floor(Math.random() * 1000);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForPort(port, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const sock = createConnection({ port }, () => { sock.destroy(); resolve(); });
        sock.on('error', reject);
      });
      return;
    } catch { await sleep(200); }
  }
  throw new Error(`Port ${port} not available after ${timeout}ms`);
}

async function sendCDP(ws, method, params = {}) {
  const id = sendCDP._id = (sendCDP._id || 0) + 1;
  return new Promise((resolve, reject) => {
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function measurePage(pageUrl, ws) {
  await sendCDP(ws, 'Network.enable');
  await sendCDP(ws, 'Network.clearBrowserCache');
  await sendCDP(ws, 'Network.clearBrowserCookies');

  const resources = new Map();
  const dataReceived = new Map();

  const onResponse = (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Network.responseReceived') {
      const { requestId, response } = msg.params;
      resources.set(requestId, {
        url: response.url,
        mimeType: response.mimeType,
        status: response.status,
        headers: response.headers,
        encodedDataLength: 0,
      });
    }
    if (msg.method === 'Network.dataReceived') {
      const { requestId, dataLength, encodedDataLength } = msg.params;
      if (resources.has(requestId)) {
        resources.get(requestId).encodedDataLength += encodedDataLength;
        if (!dataReceived.has(requestId)) dataReceived.set(requestId, { decoded: 0, encoded: 0 });
        dataReceived.get(requestId).decoded += dataLength;
        dataReceived.get(requestId).encoded += encodedDataLength;
      }
    }
    if (msg.method === 'Network.loadingFinished') {
      const { requestId, encodedDataLength } = msg.params;
      if (resources.has(requestId) && encodedDataLength > 0) {
        resources.get(requestId).encodedDataLength = encodedDataLength;
      }
    }
  };
  ws.on('message', onResponse);

  await sendCDP(ws, 'Page.navigate', { url: pageUrl });
  await sleep(5000);

  ws.removeListener('message', onResponse);

  const jsFiles = [];
  const cssFiles = [];
  let totalJsTransfer = 0;
  let totalCssTransfer = 0;

  for (const [reqId, res] of resources) {
    if (res.status !== 200) continue;
    const url = res.url;
    const isJS = url.endsWith('.js') || url.endsWith('.mjs') || res.mimeType?.includes('javascript');
    const isCSS = url.endsWith('.css') || res.mimeType?.includes('css');

    const transferSize = res.encodedDataLength || 0;
    const decodedData = dataReceived.get(reqId);
    const decodedSize = decodedData?.decoded || transferSize;

    if (isJS && url.includes('/packs/')) {
      const filename = url.split('/').pop();
      jsFiles.push({ filename, transferSize, decodedSize });
      totalJsTransfer += transferSize;
    }
    if (isCSS && url.includes('/packs/')) {
      const filename = url.split('/').pop();
      cssFiles.push({ filename, transferSize, decodedSize });
      totalCssTransfer += transferSize;
    }
  }

  return {
    url: pageUrl,
    js: { files: jsFiles, totalTransfer: totalJsTransfer, count: jsFiles.length },
    css: { files: cssFiles, totalTransfer: totalCssTransfer, count: cssFiles.length },
    totalTransfer: totalJsTransfer + totalCssTransfer,
  };
}

async function main() {
  console.log(`Starting bundle size measurement (${LABEL})...`);

  const chromeProc = (await import('child_process')).spawn(
    'google-chrome-stable',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'pipe' }
  );

  try {
    await waitForPort(CDP_PORT);
    await sleep(1000);

    const listResp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await listResp.json();
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    await sendCDP(ws, 'Page.enable');

    const results = { label: LABEL, timestamp: new Date().toISOString(), pages: [] };

    for (const page of PAGES) {
      console.log(`  Measuring: ${page.name} (${page.path})...`);
      try {
        const measurement = await measurePage(`${BASE}${page.path}`, ws);
        results.pages.push({ name: page.name, ...measurement });
        console.log(`    JS: ${(measurement.js.totalTransfer / 1024).toFixed(1)} KB (${measurement.js.count} files), CSS: ${(measurement.css.totalTransfer / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        results.pages.push({ name: page.name, error: err.message });
      }
    }

    ws.close();

    mkdirSync('.lh-results', { recursive: true });
    const outPath = `.lh-results/bundle-sizes-${LABEL}.json`;
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${outPath}`);
  } finally {
    chromeProc.kill('SIGTERM');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

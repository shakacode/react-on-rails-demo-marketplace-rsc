import { expect, request } from '@playwright/test';

const railsBaseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5017';
const railsToken = process.env.E2E_RAILS_TOKEN;

export async function app(name: 'clean' | 'scenarios/product_search') {
  if (!railsToken) {
    throw new Error('E2E_RAILS_TOKEN is required for Rails app commands');
  }

  const context = await request.newContext({
    baseURL: railsBaseURL,
    extraHTTPHeaders: {
      'X-E2E-Rails-Token': railsToken,
    },
  });

  try {
    const response = await context.post('/__e2e__/command', {
      data: { name },
    });
    const body = await response.text();

    expect(response.ok(), `Rails app command "${name}" failed: ${body}`).toBe(true);
    return JSON.parse(body);
  } finally {
    await context.dispose();
  }
}

export function appScenario(name: 'product_search') {
  return app(`scenarios/${name}`);
}

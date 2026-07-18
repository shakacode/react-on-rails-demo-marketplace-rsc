/* global URL, fetch, process */

const railsBaseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5017';
const railsToken = process.env.E2E_RAILS_TOKEN;

/** @param {'clean' | 'scenarios/product_search'} name */
export async function app(name) {
  if (!railsToken) {
    throw new Error('E2E_RAILS_TOKEN is required for Rails app commands');
  }

  const response = await fetch(new URL('/__e2e__/command', railsBaseURL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-E2E-Rails-Token': railsToken,
    },
    body: JSON.stringify({ name }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Rails app command "${name}" failed: ${body}`);
  }

  return JSON.parse(body);
}

/** @param {'product_search'} name */
export function appScenario(name) {
  return app(`scenarios/${name}`);
}

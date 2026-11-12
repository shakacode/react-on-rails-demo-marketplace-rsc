/**
 * @param {NodeJS.ProcessEnv} playwrightEnv
 * @returns {NodeJS.ProcessEnv}
 */
export function withoutRailsCapability(playwrightEnv) {
  const browserEnv = { ...playwrightEnv };
  delete browserEnv.E2E_RAILS_TOKEN;
  return browserEnv;
}

// NO 'use client' — see sanitizeAndRender.ts for the same rationale: imported
// from both server and client trees so that intl-messageformat ships to the
// browser only on SSR/Client variants and stays server-side on RSC variants.
import IntlMessageFormat from 'intl-messageformat';

// Approximate USD→{currency} conversion rates kept in lock-step with
// RestaurantDetailData::RATES so the price ladder is consistent across the
// Rails-rendered shell and any client-rendered widgets.
export const RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 152.0,
  AUD: 1.51,
  CAD: 1.36,
};

const LOCALES: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  AUD: 'en-AU',
  CAD: 'en-CA',
};

const cachedFormatters = new Map<string, IntlMessageFormat>();

function getFormatter(currency: string): IntlMessageFormat {
  const cached = cachedFormatters.get(currency);
  if (cached) return cached;
  const locale = LOCALES[currency] ?? 'en-US';
  // ICU MessageFormat for currency display — exercises intl-messageformat's
  // parser and number-formatter pipeline.
  const formatter = new IntlMessageFormat(
    '{value, number, ::currency/' + currency + '}',
    locale,
  );
  cachedFormatters.set(currency, formatter);
  return formatter;
}

export function formatPrice(usd: number, currency: string): string {
  const rate = RATES[currency] ?? 1;
  const value = usd * rate;
  return getFormatter(currency).format({ value }) as string;
}

export function buildPriceLadder(usd: number): Array<{ code: string; label: string }> {
  return Object.keys(RATES).map((code) => ({
    code,
    label: formatPrice(usd, code),
  }));
}

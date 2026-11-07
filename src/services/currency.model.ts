/**
 * Currency display (pure). TCGplayer prices are USD and Cardmarket prices EUR;
 * converting uses one EUR→USD rate from the European Central Bank (via the
 * Frankfurter API, see fx.service.ts). Any other currency is left as it is.
 */

/** "original" shows each price in the currency its provider gave. */
export type DisplayCurrency = 'USD' | 'EUR' | 'original';

export interface FxRate {
  /** US dollars per euro, e.g. 1.1165. */
  eurUsd: number;
  /** ECB date of the rate, YYYY-MM-DD. */
  date: string;
}

/** Convert between USD and EUR; undefined when it cannot (no rate, other currency). */
export function convert(amount: number, from: string, to: string, fx?: FxRate): number | undefined {
  if (from === to) return amount;
  if (!fx || !(fx.eurUsd > 0)) return undefined;
  if (from === 'EUR' && to === 'USD') return amount * fx.eurUsd;
  if (from === 'USD' && to === 'EUR') return amount / fx.eurUsd;
  return undefined;
}

export interface Converted {
  /** Sum in the target currency; undefined when nothing could be converted. */
  amount?: number;
  currency: string;
  /** Totals that could not be converted, kept in their own currency. */
  rest: Record<string, number>;
  /** True when at least one amount was converted with the rate. */
  usedRate: boolean;
}

/**
 * Collapse per-currency totals into one currency where possible. With
 * "original" (or no rate) the totals are returned unchanged in `rest`.
 */
export function convertTotals(
  byCurrency: Record<string, number>,
  target: DisplayCurrency,
  fx?: FxRate,
): Converted {
  if (target === 'original') return { currency: 'original', rest: { ...byCurrency }, usedRate: false };
  let amount: number | undefined;
  let usedRate = false;
  const rest: Record<string, number> = {};
  for (const [c, v] of Object.entries(byCurrency)) {
    const x = convert(v, c, target, fx);
    if (x === undefined) {
      rest[c] = v;
    } else {
      amount = (amount ?? 0) + x;
      if (c !== target) usedRate = true;
    }
  }
  return {
    amount: amount === undefined ? undefined : Math.round(amount * 100) / 100,
    currency: target,
    rest,
    usedRate,
  };
}

/** One comparable number for sorting by value, in USD where a rate exists. */
export function sortValue(amount: number, currency: string, fx?: FxRate): number {
  return convert(amount, currency, 'USD', fx) ?? amount;
}

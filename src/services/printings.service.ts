/**
 * Printings of one card (unlimited holo, 1st Edition, reverse holo, ...) with
 * the prices that belong to each, built from TCGdex `variants_detailed`.
 *
 * Provider data is shared between printings, so each printing picks only its
 * own keys:
 * - TCGplayer: `normal`, `holofoil`, `reverse-holofoil`, `1stEditionHolofoil`, ...
 * - Cardmarket: base keys (`trend`, `avg7`, ...) are the card's main printing,
 *   normal or holo; `-holo` keys are the reverse holo (AC-P2.7).
 */

import type { Card, PriceDetail, ProviderPricing, VariantDetail } from '../types/card';

import { extractDisplayPrices } from './tcgdex.service';

export type { VariantDetail };

export interface PrintingPrice {
  provider: 'TCGplayer' | 'Cardmarket';
  amount: number;
  currency: string;
  /** ISO date string from the provider, when given. */
  updated?: string;
  /** Change of today's figure against the 7- and 30-day averages, in percent. */
  vs7d?: number;
  vs30d?: number;
  /** TCGplayer low / high listing, when given. */
  low?: number;
  high?: number;
}

export interface Printing {
  id: string;
  /** Short label for a chip, e.g. "Holofoil · 1st Edition". */
  label: string;
  prices: PrintingPrice[];
}

const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal',
  holo: 'Holofoil',
  reverse: 'Reverse Holo',
};

function titleCase(text: string): string {
  return text
    .split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function stampLabel(stamp: string): string {
  return stamp === '1st-edition' ? '1st Edition' : titleCase(stamp);
}

/** "Holofoil · Shadowless · 1st Edition"; "unlimited" is the default and left out. */
export function printingLabel(v: VariantDetail): string {
  const parts = [TYPE_LABELS[v.type ?? ''] ?? titleCase(v.type ?? 'Printing')];
  if (v.subtype && v.subtype !== 'unlimited') {
    // Keep year ranges together: "1999-2000-copyright" -> "1999–2000 Copyright".
    parts.push(titleCase(v.subtype.replace(/(\d{4})-(\d{4})/, '$1–$2')));
  }
  for (const s of v.stamp ?? []) parts.push(stampLabel(s));
  return parts.join(' · ');
}

function percent(now: number, then: number | undefined | null): number | undefined {
  if (typeof then !== 'number' || then <= 0) return undefined;
  return ((now - then) / then) * 100;
}

function num(p: ProviderPricing, key: string): number | undefined {
  const v = p[key];
  return typeof v === 'number' && v > 0 ? v : undefined;
}

function cardmarketPrice(p: ProviderPricing | null | undefined, type: string): PrintingPrice | null {
  if (!p) return null;
  const s = type === 'reverse' ? '-holo' : '';
  const amount = num(p, `trend${s}`) ?? num(p, `avg30${s}`) ?? num(p, `avg7${s}`) ?? num(p, `avg${s}`);
  if (amount === undefined) return null;
  return {
    provider: 'Cardmarket',
    amount,
    currency: typeof p.unit === 'string' ? p.unit : 'EUR',
    updated: typeof p.updated === 'string' ? p.updated : undefined,
    vs7d: percent(amount, num(p, `avg7${s}`)),
    vs30d: percent(amount, num(p, `avg30${s}`)),
  };
}

function tcgplayerKeys(v: VariantDetail): string[] {
  const first = (v.stamp ?? []).includes('1st-edition');
  if (v.type === 'reverse') return ['reverse-holofoil'];
  if (v.type === 'normal') return first ? ['1stEdition', '1st-edition'] : ['normal', 'unlimited'];
  if (v.type === 'holo') {
    return first
      ? ['1stEditionHolofoil', '1st-edition-holofoil']
      : ['holofoil', 'unlimitedHolofoil', 'unlimited-holofoil'];
  }
  return [];
}

function tcgplayerPrice(p: ProviderPricing | null | undefined, v: VariantDetail): PrintingPrice | null {
  if (!p) return null;
  for (const key of tcgplayerKeys(v)) {
    const detail = p[key];
    if (!detail || typeof detail !== 'object') continue;
    const d = detail as PriceDetail;
    const amount = d.marketPrice ?? d.midPrice ?? d.directLowPrice ?? d.lowPrice;
    if (typeof amount !== 'number' || amount <= 0) continue;
    return {
      provider: 'TCGplayer',
      amount,
      currency: typeof p.unit === 'string' ? p.unit : 'USD',
      updated: typeof p.updated === 'string' ? p.updated : undefined,
      low: d.lowPrice,
      high: d.highPrice,
    };
  }
  return null;
}

/**
 * Printings in catalog order, each with TCGplayer first (when priced), then
 * Cardmarket. Printings without any price are kept so the user still sees
 * them, with an empty price list.
 */
export function getPrintings(card: Card): Printing[] {
  const detailed = card.variants_detailed ?? [];
  return detailed.map((v, i) => {
    const type = v.type ?? '';
    const prices = [tcgplayerPrice(v.pricing?.tcgplayer, v), cardmarketPrice(v.pricing?.cardmarket, type)]
      .filter((p): p is PrintingPrice => p !== null);
    return { id: v.variantId ?? `${type}-${i}`, label: printingLabel(v), prices };
  });
}

/**
 * Printings for any card: `variants_detailed` when TCGdex has it, otherwise
 * one printing per row of the older flat pricing fields.
 */
export function printingsFor(card: Card): Printing[] {
  const detailed = getPrintings(card);
  if (detailed.length > 0) return detailed;
  return extractDisplayPrices(card).map((p) => ({
    id: `${p.provider}-${p.variant}`,
    label: p.label,
    prices: [{ provider: p.provider, amount: p.amount, currency: p.currency, updated: p.updated }],
  }));
}

/** The printing to show first: the first one that has a price. */
export function defaultPrinting(printings: Printing[]): Printing | undefined {
  return printings.find((p) => p.prices.length > 0) ?? printings[0];
}

/** Format money with its own currency code, e.g. "$987.13" or "€353.78". */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "$1,974.26 + €3,489.25": currencies side by side (USD first), never added together. */
export function formatTotals(byCurrency: Record<string, number>): string {
  const parts = Object.entries(byCurrency)
    .sort(([a], [b]) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)))
    .map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(' + ') : formatMoney(0, 'USD');
}

/** "+12.4%" / "−3.1%" with a real minus sign. */
export function formatChange(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

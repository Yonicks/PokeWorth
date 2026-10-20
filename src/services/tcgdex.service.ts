/**
 * Thin client for the TCGdex REST API (English catalog).
 * Docs: https://tcgdex.dev — no API key required.
 *
 * Keep all HTTP details here so the provider can be swapped without
 * touching screens or the matcher.
 */

import type {
  Card,
  CardBrief,
  DisplayPrice,
  PriceDetail,
  ProviderPricing,
} from '../types/card';

const BASE_URL = 'https://api.tcgdex.net/v2/en';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`TCGdex request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

/** Fuzzy search cards by name. Returns compact records. */
export async function searchCardsByName(name: string): Promise<CardBrief[]> {
  const query = encodeURIComponent(name.trim());
  if (!query) return [];
  return get<CardBrief[]>(`/cards?name=like:${query}`);
}

/** Fetch the full card record, including set, variants, and pricing. */
export async function getCard(id: string): Promise<Card> {
  return get<Card>(`/cards/${encodeURIComponent(id)}`);
}

/**
 * Build a displayable image URL from a TCGdex base image path.
 * TCGdex image fields have no extension; quality + format must be appended.
 */
export function cardImageUrl(
  image: string | undefined,
  quality: 'low' | 'high' = 'high',
): string | undefined {
  if (!image) return undefined;
  return `${image}/${quality}.webp`;
}

const TCGPLAYER_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  'reverse-holofoil': 'Reverse Holofoil',
  'first-edition': '1st Edition',
  'first-edition-holofoil': '1st Edition Holofoil',
  unlimited: 'Unlimited',
  'unlimited-holofoil': 'Unlimited Holofoil',
};

/**
 * Cardmarket returns a flat object: "trend", "avg30", ... for the normal
 * printing and "trend-holo", "avg30-holo", ... for the holo printing.
 */
function pushCardmarketPrices(out: DisplayPrice[], pricing: ProviderPricing | null | undefined) {
  if (!pricing) return;
  const currency = typeof pricing.unit === 'string' ? pricing.unit : 'EUR';
  const updated = typeof pricing.updated === 'string' ? pricing.updated : undefined;

  const num = (key: string): number | undefined => {
    const v = pricing[key];
    return typeof v === 'number' ? v : undefined;
  };

  const variants: { suffix: string; variant: string; label: string }[] = [
    { suffix: '', variant: 'normal', label: 'Normal' },
    { suffix: '-holo', variant: 'holo', label: 'Holo / Reverse Holo' },
  ];

  for (const { suffix, variant, label } of variants) {
    // Prefer the 30-day trend-style figures over 1-day spikes or lows.
    const amount =
      num(`trend${suffix}`) ??
      num(`avg30${suffix}`) ??
      num(`avg7${suffix}`) ??
      num(`avg${suffix}`) ??
      num(`avg1${suffix}`) ??
      num(`low${suffix}`);
    if (typeof amount !== 'number') continue;
    out.push({ provider: 'Cardmarket', variant, label, amount, currency, updated });
  }
}

/** TCGplayer (when present) nests a PriceDetail object per printing. */
function pushTcgplayerPrices(out: DisplayPrice[], pricing: ProviderPricing | null | undefined) {
  if (!pricing) return;
  const currency = typeof pricing.unit === 'string' ? pricing.unit : 'USD';
  const updated = typeof pricing.updated === 'string' ? pricing.updated : undefined;

  for (const [key, value] of Object.entries(pricing)) {
    if (key === 'unit' || key === 'updated' || typeof value !== 'object' || value === null) {
      continue;
    }
    const detail = value as PriceDetail;
    const amount =
      detail.marketPrice ?? detail.midPrice ?? detail.directLowPrice ?? detail.lowPrice;
    if (typeof amount !== 'number') continue;

    out.push({
      provider: 'TCGplayer',
      variant: key,
      label: TCGPLAYER_LABELS[key] ?? key,
      amount,
      currency,
      updated,
    });
  }
}

/**
 * Flatten a card's pricing blob into display-ready rows.
 * Returns an empty array when no market data exists — callers must show
 * an explicit "no price available" state, never a made-up number.
 */
export function extractDisplayPrices(card: Card): DisplayPrice[] {
  const out: DisplayPrice[] = [];
  pushCardmarketPrices(out, card.pricing?.cardmarket);
  pushTcgplayerPrices(out, card.pricing?.tcgplayer);
  return out;
}

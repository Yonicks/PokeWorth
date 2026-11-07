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
  SetBrief,
  SetDetail,
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

/**
 * Fuzzy search cards by name, optionally only cards with exactly this HP
 * (checked 2026-11-08: "Alakazam" gives 35 cards, with hp=140 only 4).
 * Returns compact records.
 */
export async function searchCardsByName(name: string, hp?: number): Promise<CardBrief[]> {
  const query = encodeURIComponent(name.trim());
  if (!query) return [];
  return get<CardBrief[]>(`/cards?name=like:${query}${hp ? `&hp=${hp}` : ''}`);
}

/**
 * A card by set and collector number, e.g. ("sv10", "050"). Leading zeros
 * are dropped: TCGdex finds "sv03.5/50" but not "base1/004". Null when the
 * set has no such number.
 */
export async function getCardInSet(setId: string, localId: string): Promise<CardBrief | null> {
  const number = localId.replace(/^0+(?=\d)/, '');
  const res = await fetch(`${BASE_URL}/sets/${encodeURIComponent(setId)}/${encodeURIComponent(number)}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TCGdex request failed (${res.status}) for set ${setId} #${number}`);
  const c = (await res.json()) as Partial<CardBrief>;
  if (!c.id || !c.name) return null;
  return { id: c.id, localId: c.localId ?? number, name: c.name, image: c.image };
}

/** Fetch the full card record, including set, variants, and pricing. */
export async function getCard(id: string): Promise<Card> {
  return get<Card>(`/cards/${encodeURIComponent(id)}`);
}

/** Series whose sets are not physical cards (TCG Pocket is a phone game). */
const DIGITAL_SERIES = ['tcgp'];

let digitalSetsRequest: Promise<Set<string>> | null = null;

/**
 * Ids of digital-only sets (TCG Pocket: "A1", "B1a", ...). They never exist
 * in a binder, but name searches return them, e.g. Hariyama "B1a-040".
 */
export function getDigitalSetIds(): Promise<Set<string>> {
  digitalSetsRequest ??= Promise.all(
    DIGITAL_SERIES.map((id) => get<{ sets: { id: string }[] }>(`/series/${id}`)),
  )
    .then((all) => new Set(all.flatMap((s) => s.sets.map((x) => x.id))))
    .catch((error: unknown) => {
      digitalSetsRequest = null;
      throw error;
    });
  return digitalSetsRequest;
}

/**
 * All physical sets, newest first. TCGdex lists sets oldest first, so the
 * list is reversed; digital-only series are left out.
 */
export async function listSets(): Promise<SetBrief[]> {
  const [sets, digital] = await Promise.all([
    get<SetBrief[]>('/sets'),
    Promise.all(
      DIGITAL_SERIES.map((id) =>
        get<{ sets: { id: string }[] }>(`/series/${id}`).catch(() => ({ sets: [] })),
      ),
    ),
  ]);
  const skip = new Set(digital.flatMap((s) => s.sets.map((x) => x.id)));
  return sets.filter((s) => !skip.has(s.id)).reverse();
}

/** One set with its card list. */
export async function getSet(id: string): Promise<SetDetail> {
  return get<SetDetail>(`/sets/${encodeURIComponent(id)}`);
}

let setsRequest: Promise<SetBrief[]> | null = null;

/** The whole set list, oldest first, cached for the session (a failure is not cached). */
function allSets(): Promise<SetBrief[]> {
  setsRequest ??= get<SetBrief[]>('/sets').catch((error: unknown) => {
    setsRequest = null;
    throw error;
  });
  return setsRequest;
}

/** Official (printed) card count per set id, e.g. "base1" -> 102. */
export async function getSetSizes(): Promise<Map<string, number>> {
  return new Map((await allSets()).map((s) => [s.id, s.cardCount.official]));
}

/**
 * Release order per set id: a higher number is a newer set (TCGdex lists sets
 * oldest first). Used to prefer newer printings when everything else ties.
 */
export async function getSetOrder(): Promise<Map<string, number>> {
  return new Map((await allSets()).map((s, i) => [s.id, i]));
}

/** Set id from a card id: "base1-4" -> "base1", "sv06.5-042" -> "sv06.5". */
export function setIdOf(card: CardBrief): string {
  const suffix = `-${card.localId}`;
  return card.id.endsWith(suffix) ? card.id.slice(0, -suffix.length) : card.id;
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

/** Set logo URL; TCGdex logo paths have no extension either. WebP is ~4× smaller than PNG. */
export function setLogoUrl(logo: string | undefined): string | undefined {
  return logo ? `${logo}.webp` : undefined;
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

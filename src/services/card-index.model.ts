/**
 * On-device card index (S2): every English card with the facts the matcher uses, so a scan
 * is matched on the phone with no network call. Pure functions only (no storage, no
 * network), so they run in the offline fixtures.
 *
 * Stored form is compact: a row is [id, localId, name, hp, attack names joined by "|"].
 * The set of a card comes from its id ("base1-4" -> "base1"), as in `setIdOf`.
 */

import type { Card, CardBrief } from '../types/card';
import { normalize } from '../utils/text';

export const INDEX_VERSION = 1;
/** An index older than this is refreshed in the background. */
export const INDEX_MAX_AGE_DAYS = 14;
/** Below this many cards a download is treated as broken and never replaces a good index. */
export const MIN_PLAUSIBLE_CARDS = 5000;

export type IndexRow = [id: string, localId: string, name: string, hp: number, attacks: string];

/** [id, name, series id, printed card count], in release order (oldest first). */
export type IndexSet = [id: string, name: string, serie: string, official: number];

export interface StoredIndex {
  v: number;
  builtAt: string;
  sets: IndexSet[];
  rows: IndexRow[];
}

/** Series whose sets are digital-only (TCG Pocket); they never exist in a binder. */
export const DIGITAL_SERIES = new Set(['tcgp']);

export interface CardIndex {
  builtAt: string;
  size: number;
  /** Search by name; `hp` keeps only cards with exactly that HP. Like TCGdex's `name=like:`. */
  search(name: string, hp?: number): CardBrief[];
  /** Cards with this collector number in sets whose printed size is `setTotal`. */
  byNumber(localId: string, setTotal: number): CardBrief[];
  /** Attack names of one card, as a minimal card record. */
  detail(id: string): Card | undefined;
  setSizes: Map<string, number>;
  setNames: Map<string, string>;
  setOrder: Map<string, number>;
  digitalSetIds: Set<string>;
}

function setIdFromRow(id: string, localId: string): string {
  const suffix = `-${localId}`;
  return id.endsWith(suffix) ? id.slice(0, -suffix.length) : id;
}

function normalizeLocalId(id: string): string {
  return normalize(id).replace(/^0+(?=\d)/, '').replace(/\s/g, '');
}

/** TCGdex asset path of a card image (no extension; `cardImageUrl` adds quality and format). */
export function imageBase(serie: string | undefined, setId: string, localId: string): string | undefined {
  return serie ? `https://assets.tcgdex.net/en/${serie}/${setId}/${localId}` : undefined;
}

/** Whether parsed JSON has the shape of a stored index with a believable number of cards. */
export function isUsableStoredIndex(value: unknown): value is StoredIndex {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<StoredIndex>;
  return (
    v.v === INDEX_VERSION &&
    typeof v.builtAt === 'string' &&
    Array.isArray(v.sets) &&
    Array.isArray(v.rows) &&
    v.rows.length >= MIN_PLAUSIBLE_CARDS
  );
}

export function parseStoredIndex(json: string | null): StoredIndex | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    return isUsableStoredIndex(value) ? value : null;
  } catch {
    return null;
  }
}

export function isStale(builtAt: string, now: number = Date.now()): boolean {
  const t = Date.parse(builtAt);
  return Number.isNaN(t) || now - t > INDEX_MAX_AGE_DAYS * 86_400_000;
}

/** Build the lookup structures. Rows are kept as they are; nothing is copied per card. */
export function buildIndex(stored: StoredIndex): CardIndex {
  const serieOf = new Map(stored.sets.map(([id, , serie]) => [id, serie]));
  const setSizes = new Map(stored.sets.map(([id, , , n]) => [id, n]));
  const setNames = new Map(stored.sets.map(([id, name]) => [id, name]));
  const setOrder = new Map(stored.sets.map(([id], i) => [id, i]));
  const digitalSetIds = new Set(stored.sets.filter(([, , s]) => DIGITAL_SERIES.has(s)).map(([id]) => id));

  const rows = stored.rows;
  const names = rows.map((r) => normalize(r[2]));
  const byId = new Map(rows.map((r, i) => [r[0], i]));

  const brief = (r: IndexRow): CardBrief => ({
    id: r[0],
    localId: r[1],
    name: r[2],
    image: imageBase(serieOf.get(setIdFromRow(r[0], r[1])), setIdFromRow(r[0], r[1]), r[1]),
  });

  return {
    builtAt: stored.builtAt,
    size: rows.length,
    setSizes,
    setNames,
    setOrder,
    digitalSetIds,
    search(name, hp) {
      const q = normalize(name);
      if (!q) return [];
      const out: CardBrief[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (!names[i].includes(q)) continue;
        if (hp && rows[i][3] !== hp) continue;
        out.push(brief(rows[i]));
      }
      return out;
    },
    byNumber(localId, setTotal) {
      const want = normalizeLocalId(localId);
      const out: CardBrief[] = [];
      for (const r of rows) {
        if (normalizeLocalId(r[1]) !== want) continue;
        if (setSizes.get(setIdFromRow(r[0], r[1])) !== setTotal) continue;
        out.push(brief(r));
        if (out.length >= 8) break;
      }
      return out;
    },
    detail(id) {
      const i = byId.get(id);
      if (i === undefined) return undefined;
      const r = rows[i];
      return { ...brief(r), attacks: r[4] ? r[4].split('|').map((name) => ({ name })) : [] };
    },
  };
}

/** One GraphQL card as TCGdex returns it (attack entries can be null). */
export interface RawCard {
  id: string;
  localId: string;
  name: string;
  hp?: number | null;
  attacks?: ({ name: string } | null)[] | null;
}

export interface RawSet {
  id: string;
  name: string;
  serie?: { id: string } | null;
  cardCount?: { official?: number } | null;
}

export function toRow(c: RawCard): IndexRow {
  const attacks = (c.attacks ?? [])
    .map((a) => a?.name)
    .filter((n): n is string => !!n)
    .join('|');
  return [c.id, c.localId, c.name, c.hp ?? 0, attacks];
}

/**
 * Assemble a stored index from the raw download. `order` is the set ids oldest first (the
 * REST set list); sets missing from it keep the download's order after the known ones.
 */
export function assembleIndex(cards: RawCard[], sets: RawSet[], order: string[], builtAt: string): StoredIndex {
  const rank = new Map(order.map((id, i) => [id, i]));
  const orderedSets = [...sets].sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  return {
    v: INDEX_VERSION,
    builtAt,
    sets: orderedSets.map((s): IndexSet => [s.id, s.name, s.serie?.id ?? '', s.cardCount?.official ?? 0]),
    rows: cards.filter((c) => c && c.id && c.name).map(toRow),
  };
}

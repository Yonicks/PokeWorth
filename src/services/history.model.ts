/**
 * Price history recorded on the device (decision 1, 2026-11-07). Pure rules,
 * stored as `pokeworth.history.v1` by history.service.ts.
 *
 * TCGdex only gives today's prices, so history starts on the day a card is
 * first seen and gains at most one point per day. Nothing is back-filled.
 */

/** One day's price: date (local YYYY-MM-DD), value, currency. */
export interface Point {
  d: string;
  v: number;
  c: string;
}

/** One day's portfolio value, per currency (never mixed). */
export interface ValuePoint {
  d: string;
  t: Record<string, number>;
}

export interface HistoryState {
  version: 1;
  /** Keyed by `cardId|printingId`. */
  cards: Record<string, Point[]>;
  /** Keyed by portfolio id. */
  portfolios: Record<string, ValuePoint[]>;
  /** Day the automatic daily refresh last ran. */
  lastDaily?: string;
}

export type Range = '1M' | '3M' | '6M' | '12M' | 'MAX';
export const RANGES: Range[] = ['1M', '3M', '6M', '12M', 'MAX'];

/** About two years of daily points per series. */
const MAX_POINTS = 730;
/** Series kept; the least recently updated are dropped first. */
const MAX_CARD_SERIES = 1500;

export function emptyHistory(): HistoryState {
  return { version: 1, cards: {}, portfolios: {} };
}

export function parseHistory(raw: string | null | undefined): HistoryState {
  if (!raw) return emptyHistory();
  try {
    const data = JSON.parse(raw) as Partial<HistoryState>;
    if (!data || data.version !== 1 || typeof data.cards !== 'object' || !data.cards) return emptyHistory();
    const cards: Record<string, Point[]> = {};
    for (const [k, pts] of Object.entries(data.cards)) {
      if (!Array.isArray(pts)) continue;
      const ok = pts.filter(
        (p): p is Point => !!p && typeof p.d === 'string' && typeof p.v === 'number' && typeof p.c === 'string',
      );
      if (ok.length) cards[k] = ok;
    }
    const portfolios: Record<string, ValuePoint[]> = {};
    for (const [k, pts] of Object.entries(data.portfolios ?? {})) {
      if (!Array.isArray(pts)) continue;
      const ok = pts.filter((p): p is ValuePoint => !!p && typeof p.d === 'string' && !!p.t && typeof p.t === 'object');
      if (ok.length) portfolios[k] = ok;
    }
    return { version: 1, cards, portfolios, lastDaily: typeof data.lastDaily === 'string' ? data.lastDaily : undefined };
  } catch {
    return emptyHistory();
  }
}

/** Local calendar day, e.g. "2026-11-07". */
export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seriesKey(cardId: string, printingId: string): string {
  return `${cardId}|${printingId}`;
}

/** Insert or replace the point for that day, keeping the series sorted and capped. */
function upsert<T extends { d: string }>(points: T[] | undefined, point: T): T[] {
  const rest = (points ?? []).filter((p) => p.d !== point.d);
  rest.push(point);
  rest.sort((a, b) => a.d.localeCompare(b.d));
  return rest.slice(-MAX_POINTS);
}

/** Record today's price for a printing. A change of currency restarts the series. */
export function addCardPoint(state: HistoryState, key: string, point: Point): HistoryState {
  if (!(point.v > 0)) return state;
  const existing = state.cards[key];
  const base = existing && existing.length && existing[existing.length - 1].c !== point.c ? [] : existing;
  let cards = { ...state.cards, [key]: upsert(base, point) };
  const keys = Object.keys(cards);
  if (keys.length > MAX_CARD_SERIES) {
    const oldest = keys
      .map((k) => [k, cards[k][cards[k].length - 1].d] as const)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, keys.length - MAX_CARD_SERIES)
      .map(([k]) => k);
    cards = Object.fromEntries(Object.entries(cards).filter(([k]) => !oldest.includes(k)));
  }
  return { ...state, cards };
}

export function addPortfolioPoint(
  state: HistoryState,
  portfolioId: string,
  point: ValuePoint,
): HistoryState {
  return {
    ...state,
    portfolios: { ...state.portfolios, [portfolioId]: upsert(state.portfolios[portfolioId], point) },
  };
}

const RANGE_DAYS: Record<Exclude<Range, 'MAX'>, number> = { '1M': 30, '3M': 91, '6M': 182, '12M': 365 };

/** Points inside the range, counting back from `today`. */
export function inRange<T extends { d: string }>(points: T[], range: Range, today = dayKey()): T[] {
  if (range === 'MAX') return points;
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - RANGE_DAYS[range]);
  const from = dayKey(start);
  return points.filter((p) => p.d >= from);
}

/** Percent change from the first to the last point, or undefined with fewer than 2. */
export function changeOf(points: { v: number }[]): number | undefined {
  if (points.length < 2 || !(points[0].v > 0)) return undefined;
  return ((points[points.length - 1].v - points[0].v) / points[0].v) * 100;
}

/** Days between the first and last point (0 for a single point). */
export function spanDays(points: { d: string }[]): number {
  if (points.length < 2) return 0;
  const a = new Date(`${points[0].d}T00:00:00`).getTime();
  const b = new Date(`${points[points.length - 1].d}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

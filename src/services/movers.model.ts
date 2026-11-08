/**
 * Price movers from the history recorded on the phone, pure and tested offline.
 *
 * A change over N days compares the latest point with the newest point that is
 * at least N days old. With no point that old (a card first seen yesterday) the
 * change is simply unknown rather than guessed.
 */

import type { CollectionEntry } from './collection.model';
import { dayKey, seriesKey, type HistoryState } from './history.model';

export type MoverDays = 7 | 30;

export interface Change {
  /** Latest minus the earlier value, in the series' currency. */
  amount: number;
  /** Percent of the earlier value. */
  pct: number;
  /** The date compared against. */
  from: string;
}

function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - days);
  return dayKey(d);
}

/** Change of a sorted series over `days`, or undefined when it has no point that old. */
export function changeOver(points: { d: string; v: number }[], days: number, today = dayKey()): Change | undefined {
  if (points.length < 2) return undefined;
  const cutoff = daysBefore(today, days);
  let base: { d: string; v: number } | undefined;
  for (const p of points) if (p.d <= cutoff) base = p;
  const last = points[points.length - 1];
  if (!base || !(base.v > 0) || base.d === last.d) return undefined;
  return { amount: last.v - base.v, pct: ((last.v - base.v) / base.v) * 100, from: base.d };
}

export interface Mover {
  entry: CollectionEntry;
  /** Per copy. */
  change: Change;
  currency: string;
  /** Change times quantity, in `currency`. */
  total: number;
}

/**
 * Owned cards ranked by percent change over `days`, using only series in the
 * same currency as the entry's price. Changes under 0.5% are ignored as noise.
 */
export function cardMovers(
  history: HistoryState,
  entries: CollectionEntry[],
  days: MoverDays,
  today = dayKey(),
): { gainers: Mover[]; losers: Mover[] } {
  const seen = new Set<string>();
  const list: Mover[] = [];
  for (const entry of entries) {
    if (entry.graded) continue;
    const key = seriesKey(entry.cardId, entry.printingId);
    if (seen.has(key)) continue;
    seen.add(key);
    const series = history.cards[key];
    if (!series) continue;
    const change = changeOver(series, days, today);
    if (!change || Math.abs(change.pct) < 0.5) continue;
    const currency = series[series.length - 1].c;
    const qty = entries.filter((e) => !e.graded && seriesKey(e.cardId, e.printingId) === key).reduce((n, e) => n + e.quantity, 0);
    list.push({ entry, change, currency, total: change.amount * qty });
  }
  return {
    gainers: list.filter((m) => m.change.pct > 0).sort((a, b) => b.change.pct - a.change.pct),
    losers: list.filter((m) => m.change.pct < 0).sort((a, b) => a.change.pct - b.change.pct),
  };
}

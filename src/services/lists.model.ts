/**
 * Trade list and want list, pure and tested offline.
 *
 * Trade list: raw copies beyond the first of a printing (you keep one, the rest
 * are spare). Graded cards are never listed as spare. Want list: favourites you
 * do not own in the active portfolio. Both can be turned into plain text to share.
 */

import { entriesIn, type CollectionEntry, type CollectionState } from './collection.model';
import { formatMoney } from './printings.service';

export interface ListLine {
  /** Copies (trade list only). */
  qty?: number;
  name: string;
  setName?: string;
  number?: string;
  printing?: string;
  /** Price of one copy. */
  price?: { amount: number; currency: string };
}

/** Spare copies: quantity minus the one you keep, highest total value first. */
export function tradeLines(state: CollectionState): ListLine[] {
  const spare = entriesIn(state)
    .filter((e) => !e.graded && e.quantity >= 2)
    .map((e) => ({ e, extra: e.quantity - 1 }));
  const value = (x: { e: CollectionEntry; extra: number }) => (x.e.price ? x.e.price.amount * x.extra : -1);
  return spare
    .sort((a, b) => value(b) - value(a))
    .map(({ e, extra }) => ({
      qty: extra,
      name: e.card.name,
      setName: e.card.setName,
      number: e.card.number ?? e.card.localId,
      printing: e.printingLabel,
      price: e.price ? { amount: e.price.amount, currency: e.price.currency } : undefined,
    }));
}

/** Favourite card ids that are not in the active portfolio (any printing). */
export function wantIds(state: CollectionState): string[] {
  const owned = new Set(entriesIn(state).map((e) => e.cardId));
  return state.favorites.filter((id) => !owned.has(id));
}

/** Sum per currency of qty × price (qty 1 when not given); currencies are never mixed. */
export function listTotals(lines: ListLine[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) {
    if (!l.price || !(l.price.amount > 0)) continue;
    out[l.price.currency] = (out[l.price.currency] ?? 0) + l.price.amount * (l.qty ?? 1);
  }
  for (const c of Object.keys(out)) out[c] = Math.round(out[c] * 100) / 100;
  return out;
}

function lineText(l: ListLine): string {
  const where = [l.setName, l.number ? `#${l.number}` : undefined].filter(Boolean).join(' ');
  const parts = [l.name, where, l.printing && l.printing !== 'Normal' ? l.printing : undefined].filter(Boolean);
  const head = `${l.qty ? `${l.qty}× ` : ''}${parts.join(' · ')}`;
  return l.price ? `${head} — ${formatMoney(l.price.amount, l.price.currency)}` : head;
}

/** Plain text for a message: a title, one line per card and (if priced) the totals. */
export function listText(title: string, lines: ListLine[], showTotal = true): string {
  if (lines.length === 0) return `${title}\n(empty)`;
  const out = [title, ...lines.map(lineText)];
  const totals = listTotals(lines);
  const entries = Object.entries(totals);
  if (showTotal && entries.length) {
    out.push(`Total: ${entries.map(([c, v]) => formatMoney(v, c)).join(' + ')} (market estimates)`);
  }
  return out.join('\n');
}

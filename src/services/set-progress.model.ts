/**
 * Set completion rules, pure and tested offline. "Owned" means at least one
 * copy (raw or graded) of the card, in any printing, in the active portfolio.
 */

import { entriesIn, type CollectionState } from './collection.model';

export interface SetProgress {
  owned: number;
  total: number;
  /** Whole percent, 0–100. */
  pct: number;
}

/** Ids of the cards the active portfolio holds. */
export function ownedCardIds(state: CollectionState, portfolioId = state.activePortfolioId): Set<string> {
  return new Set(entriesIn(state, portfolioId).map((e) => e.cardId));
}

/** How many different cards of each set are owned, keyed by set id. */
export function ownedPerSet(state: CollectionState, portfolioId = state.activePortfolioId): Record<string, number> {
  const seen = new Set<string>();
  const out: Record<string, number> = {};
  for (const e of entriesIn(state, portfolioId)) {
    if (!e.card.setId || seen.has(e.cardId)) continue;
    seen.add(e.cardId);
    out[e.card.setId] = (out[e.card.setId] ?? 0) + 1;
  }
  return out;
}

export function progressOf(owned: number, total: number): SetProgress {
  const t = Math.max(0, total);
  const o = Math.max(0, Math.min(owned, t || owned));
  return { owned: o, total: t, pct: t > 0 ? Math.min(100, Math.round((o / t) * 100)) : 0 };
}

export type SetFilter = 'all' | 'owned' | 'missing';

export function filterSetCards<T extends { id: string }>(cards: T[], owned: Set<string>, filter: SetFilter): T[] {
  if (filter === 'owned') return cards.filter((c) => owned.has(c.id));
  if (filter === 'missing') return cards.filter((c) => !owned.has(c.id));
  return cards;
}

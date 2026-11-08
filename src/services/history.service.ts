/**
 * Price history persistence (`pokeworth.history.v1`) and the once-a-day
 * snapshot of owned cards. Rules live in history.model.ts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import type { Card } from '../types/card';
import { totals, type CollectionState } from './collection.model';
import {
  addCardPoint,
  addPortfolioPoint,
  dayKey,
  parseHistory,
  seedPoints,
  seriesKey,
  type HistoryState,
} from './history.model';
import { refreshPortfolioPrices } from './portfolio-refresh';
import { printingsFor } from './printings.service';

const KEY = 'pokeworth.history.v1';

export async function loadHistory(): Promise<HistoryState> {
  try {
    return parseHistory(await AsyncStorage.getItem(KEY));
  } catch {
    return parseHistory(null);
  }
}

let queue: Promise<unknown> = Promise.resolve();

export function updateHistory(change: (h: HistoryState) => HistoryState): Promise<HistoryState> {
  const run = queue.then(async () => {
    const next = change(await loadHistory());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Add today's price of every priced printing of a card. A printing with no
 * history yet and a Cardmarket price also gets estimated points from the
 * 1/7/30-day averages (TCGplayer data has no averages, so those start today).
 */
export function withCard(h: HistoryState, card: Card, day = dayKey()): HistoryState {
  return printingsFor(card).reduce((acc, p) => {
    const price = p.prices[0];
    if (!price) return acc;
    const key = seriesKey(card.id, p.id);
    // First sighting of a Cardmarket-priced printing: start from its averages.
    const seeded =
      !acc.cards[key]?.length && price.provider === 'Cardmarket'
        ? seedPoints(price, price.currency, day).reduce((a, pt) => addCardPoint(a, key, pt), acc)
        : acc;
    return addCardPoint(seeded, key, { d: day, v: price.amount, c: price.currency });
  }, h);
}

/** Add today's value of every portfolio that has cards. */
export function withPortfolios(h: HistoryState, state: CollectionState, day = dayKey()): HistoryState {
  return state.portfolios.reduce((acc, p) => {
    const entries = state.entries.filter((e) => e.portfolioId === p.id);
    if (entries.length === 0 && !acc.portfolios[p.id]) return acc;
    return addPortfolioPoint(acc, p.id, { d: day, t: totals(entries).byCurrency });
  }, h);
}

/**
 * Once per calendar day: refresh prices of all owned cards, then record a
 * point for each of them and for each portfolio. Returns the refreshed
 * collection change, or null when today's run already happened.
 */
export async function runDailySnapshot(
  client: QueryClient,
  collection: CollectionState,
): Promise<((s: CollectionState) => CollectionState) | null> {
  const today = dayKey();
  const history = await loadHistory();
  if (history.lastDaily === today || collection.entries.length === 0) return null;
  const { change, cards } = await refreshPortfolioPrices(client, collection);
  const refreshed = change(collection);
  await updateHistory((h) => ({
    ...withPortfolios(cards.reduce((acc, c) => withCard(acc, c, today), h), refreshed, today),
    lastDaily: today,
  }));
  return change;
}

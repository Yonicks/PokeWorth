/** Refresh stored prices for every card in the collection (pull-to-refresh, daily run). */

import type { QueryClient } from '@tanstack/react-query';

import type { Card } from '../types/card';
import { updatePrices, type CollectionState, type PriceSnapshot } from './collection.model';
import { snapshotPrice } from './collection.service';
import { printingsFor } from './printings.service';
import { getCard } from './tcgdex.service';

const PARALLEL = 4;

export interface RefreshResult {
  /** Applies the new prices to a collection state. */
  change: (s: CollectionState) => CollectionState;
  /** Cards that loaded, for recording price history. */
  cards: Card[];
  failed: number;
}

/**
 * Fetch each owned card once, across all portfolios (through the query
 * cache, so cards fetched in the last few minutes are reused). Cards that
 * fail to load keep their old price; their count is returned.
 */
export async function refreshPortfolioPrices(
  client: QueryClient,
  state: CollectionState,
): Promise<RefreshResult> {
  const ids = [...new Set(state.entries.map((e) => e.cardId))];
  const results: { id: string; prices: Record<string, PriceSnapshot | undefined> }[] = [];
  const cards: Card[] = [];
  let failed = 0;

  for (let i = 0; i < ids.length; i += PARALLEL) {
    await Promise.all(
      ids.slice(i, i + PARALLEL).map(async (id) => {
        try {
          const card = await client.fetchQuery<Card>({
            queryKey: ['card', id],
            queryFn: () => getCard(id),
            staleTime: 1000 * 60 * 5,
          });
          const prices: Record<string, PriceSnapshot | undefined> = {};
          for (const p of printingsFor(card)) prices[p.id] = snapshotPrice(p);
          results.push({ id, prices });
          cards.push(card);
        } catch {
          failed++;
        }
      }),
    );
  }

  return {
    change: (s) => results.reduce((acc, r) => updatePrices(acc, r.id, r.prices), s),
    cards,
    failed,
  };
}

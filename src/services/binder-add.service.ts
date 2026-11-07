/**
 * Turn the ticked pockets of a binder page into portfolio additions
 * (binder scan step 5). Each distinct card is fetched once (through the query
 * cache, so cards just matched are reused) to get its printings and prices.
 */

import type { QueryClient } from '@tanstack/react-query';

import type { Card } from '../types/card';
import { addLines, type ReviewPocket } from './binder-review.model';
import { addMany, type AddManyItem } from './collection.model';
import { entryInputFor } from './collection.service';
import { defaultPrinting, printingsFor } from './printings.service';
import { getCard } from './tcgdex.service';

export interface AddPlan {
  items: AddManyItem[];
  /** Cards that could not be loaded, with how many pockets they cover. */
  failed: number;
  /** Copies added per currency, for the summary ("$412.30"). */
  value: Record<string, number>;
  cards: number;
  copies: number;
}

export async function planAdd(client: QueryClient, review: ReviewPocket[]): Promise<AddPlan> {
  const lines = addLines(review);
  const items: AddManyItem[] = [];
  const value: Record<string, number> = {};
  let failed = 0;
  let copies = 0;
  for (const line of lines) {
    try {
      const card = await client.fetchQuery<Card>({
        queryKey: ['card', line.cardId],
        queryFn: () => getCard(line.cardId),
        staleTime: 1000 * 60 * 10,
      });
      const printings = printingsFor(card);
      const printing = printings.find((p) => p.id === line.printingId) ?? defaultPrinting(printings);
      if (!printing) throw new Error('No printing');
      items.push({ input: entryInputFor(card, printing), quantity: line.quantity });
      copies += line.quantity;
      const price = printing.prices[0];
      if (price) value[price.currency] = (value[price.currency] ?? 0) + price.amount * line.quantity;
    } catch {
      failed += line.quantity;
    }
  }
  return { items, failed, value, cards: items.length, copies };
}

export { addMany };

/**
 * Collection persistence (AsyncStorage key `pokeworth.collection.v1`).
 * The rules live in collection.model.ts; this file only loads, saves and
 * builds entries from catalog data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Card } from '../types/card';
import {
  parseCollection,
  type CollectionState,
  type EntryInput,
  type PriceSnapshot,
} from './collection.model';
import type { Printing } from './printings.service';

const KEY = 'pokeworth.collection.v1';

export async function loadCollection(): Promise<CollectionState> {
  try {
    return parseCollection(await AsyncStorage.getItem(KEY));
  } catch {
    return parseCollection(null);
  }
}

// Writes run one after another so two quick taps never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

/** Load, apply `change`, save, and return the saved state. */
export function updateCollection(
  change: (state: CollectionState) => CollectionState,
): Promise<CollectionState> {
  const run = queue.then(async () => {
    const next = change(await loadCollection());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** The price an entry keeps: the printing's first (preferred) provider price. */
export function snapshotPrice(printing: Printing): PriceSnapshot | undefined {
  const p = printing.prices[0];
  return p ? { amount: p.amount, currency: p.currency, provider: p.provider, updated: p.updated } : undefined;
}

export function entryInputFor(card: Card, printing: Printing, portfolioId?: string): EntryInput {
  const official = card.set?.cardCount?.official;
  return {
    cardId: card.id,
    printingId: printing.id,
    printingLabel: printing.label,
    portfolioId,
    price: snapshotPrice(printing),
    card: {
      name: card.name,
      localId: card.localId,
      number: official ? `${card.localId}/${official}` : card.localId,
      setId: card.set?.id,
      setName: card.set?.name,
      rarity: card.rarity,
      image: card.image,
    },
  };
}

/**
 * The card index currently in memory. Kept apart from the storage service so the matcher
 * (which the offline fixtures also run) never imports AsyncStorage.
 */

import type { CardIndex } from './card-index.model';

let current: CardIndex | null = null;

export function getCardIndex(): CardIndex | null {
  return current;
}

export function setCardIndex(index: CardIndex | null): void {
  current = index;
}

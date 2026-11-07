/** Outside links (opened in the in-app browser). */

import type { Card } from '../types/card';

/**
 * eBay's sold-items search for a card, optionally narrowed to a grade such
 * as "PSA 10". A plain link: no API, no key.
 */
export function soldListingsUrl(card: Card, grade?: string): string {
  const number = card.set?.cardCount?.official
    ? `${card.localId}/${card.set.cardCount.official}`
    : card.localId;
  const query = [card.name, number, card.set?.name, grade].filter(Boolean).join(' ');
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

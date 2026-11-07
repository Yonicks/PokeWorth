/**
 * Review grid rules (binder scan steps 4 and 5), pure and tested offline.
 *
 * Each pocket starts from the reader's result: the best match is selected,
 * and only "Sure" pockets start ticked (decision 3). The user can tick,
 * choose another candidate or printing, or skip a pocket. Ticked pockets
 * become portfolio additions; the same card and printing on one page is
 * added once with a higher quantity.
 */

import { startsTicked, type PocketStatus } from './binder-scan.model';
import type { PocketResult } from './binder-scan.service';
import type { CardBrief } from '../types/card';

export interface ReviewPocket {
  index: number;
  row: number;
  col: number;
  uri: string;
  status: PocketStatus;
  /** Best guesses from the matcher, most likely first (at most 5). */
  candidates: CardBrief[];
  /** The card the user (or the matcher) picked for this pocket. */
  cardId?: string;
  /** Printing id chosen in the sheet; undefined means "the card's main printing". */
  printingId?: string;
  ticked: boolean;
}

export const MAX_CANDIDATES_SHOWN = 5;

export function initReview(results: (PocketResult | undefined)[]): ReviewPocket[] {
  return results
    .filter((r): r is PocketResult => !!r)
    .map((r) => {
      const candidates = (r.outcome?.candidates ?? []).slice(0, MAX_CANDIDATES_SHOWN).map((c) => c.card);
      const hasCard = (r.status === 'sure' || r.status === 'check') && candidates.length > 0;
      return {
        index: r.index,
        row: r.row,
        col: r.col,
        uri: r.uri,
        status: r.status,
        candidates,
        cardId: hasCard ? candidates[0].id : undefined,
        ticked: hasCard && startsTicked(r.status),
      };
    });
}

/** Whether a pocket can be added at all (a card is selected). */
export function canAdd(p: ReviewPocket): boolean {
  return !!p.cardId;
}

export function toggleTick(list: ReviewPocket[], index: number): ReviewPocket[] {
  return list.map((p) => (p.index === index && canAdd(p) ? { ...p, ticked: !p.ticked } : p));
}

/** Pick another candidate: that card is selected, its printing reset, and the pocket ticked. */
export function chooseCard(list: ReviewPocket[], index: number, card: CardBrief): ReviewPocket[] {
  return list.map((p) => {
    if (p.index !== index) return p;
    const known = p.candidates.some((c) => c.id === card.id);
    return {
      ...p,
      candidates: known ? p.candidates : [card, ...p.candidates].slice(0, MAX_CANDIDATES_SHOWN + 1),
      cardId: card.id,
      printingId: undefined,
      ticked: true,
    };
  });
}

export function choosePrinting(list: ReviewPocket[], index: number, printingId: string): ReviewPocket[] {
  return list.map((p) => (p.index === index ? { ...p, printingId } : p));
}

/** Untick a pocket (skip it). */
export function skipPocket(list: ReviewPocket[], index: number): ReviewPocket[] {
  return list.map((p) => (p.index === index ? { ...p, ticked: false } : p));
}

export function tickedCount(list: ReviewPocket[]): number {
  return list.filter((p) => p.ticked && canAdd(p)).length;
}

/** One line to add: a card, its printing (undefined = main printing) and how many copies on this page. */
export interface AddLine {
  cardId: string;
  printingId?: string;
  quantity: number;
  /** Pocket indexes it came from, for the summary. */
  pockets: number[];
}

/** Ticked pockets grouped by card + printing, in page order. */
export function addLines(list: ReviewPocket[]): AddLine[] {
  const lines = new Map<string, AddLine>();
  for (const p of [...list].sort((a, b) => a.index - b.index)) {
    if (!p.ticked || !p.cardId) continue;
    const key = `${p.cardId}|${p.printingId ?? ''}`;
    const line = lines.get(key);
    if (line) {
      line.quantity += 1;
      line.pockets.push(p.index);
    } else {
      lines.set(key, { cardId: p.cardId, printingId: p.printingId, quantity: 1, pockets: [p.index] });
    }
  }
  return [...lines.values()];
}

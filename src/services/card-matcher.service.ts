/**
 * Turns raw OCR lines into a structured query, then ranks catalog
 * candidates. Rule from the plan: never silently treat a low-confidence
 * match as the exact card — ambiguity is surfaced to the Confirm screen.
 */

import type { Card, CardBrief, ParsedCardText, ScoredCandidate } from '../types/card';
import { normalize, similarity } from '../utils/text';
import { searchCardsByName, getCard } from './tcgdex.service';

/** Collector number like "4/102", "TG12/TG30", "SWSH284" (promo, no slash). */
const COLLECTOR_NUMBER_RE = /\b([A-Z]{0,4}\d{1,3}[a-z]?)\s*\/\s*([A-Z]{0,4}\d{1,3})\b/;

/** Lines that are card chrome, not the card's name. */
const NAME_STOPWORDS = new Set([
  'basic', 'stage 1', 'stage 2', 'stage1', 'stage2', 'vmax', 'vstar',
  'trainer', 'supporter', 'item', 'stadium', 'tool', 'energy',
  'evolves from', 'put onto', 'ability', 'weakness', 'resistance',
  'retreat', 'illus', 'pokemon', 'pokemon lv',
]);

function looksLikeName(line: string): boolean {
  const n = normalize(line);
  if (n.length < 3 || n.length > 25) return false;
  if (NAME_STOPWORDS.has(n)) return false;
  for (const stop of NAME_STOPWORDS) {
    if (n.startsWith(stop + ' ') || n.startsWith('evolves')) return false;
  }
  // Mostly letters (allow things like "Mewtwo ex", "Pikachu V").
  const letters = n.replace(/[^a-z]/g, '').length;
  if (letters / n.length < 0.6) return false;
  // Reject lines that are clearly stats, e.g. "HP 120".
  if (/\bhp\b|\d{2,}/.test(n)) return false;
  return true;
}

/** Extract name + collector number from raw OCR lines. */
export function parseOcrLines(rawLines: string[]): ParsedCardText {
  const result: ParsedCardText = { rawLines };

  for (const line of rawLines) {
    const m = COLLECTOR_NUMBER_RE.exec(line);
    if (m) {
      result.localId = m[1];
      const total = parseInt(m[2].replace(/\D/g, ''), 10);
      if (!Number.isNaN(total)) result.setTotal = total;
      break;
    }
  }

  // Card names are printed near the top, so take the first plausible line.
  for (const line of rawLines) {
    if (looksLikeName(line)) {
      result.name = line.trim();
      break;
    }
  }

  return result;
}

function normalizeLocalId(id: string): string {
  // "004" -> "4", keep letter prefixes ("TG12" -> "tg12").
  return normalize(id).replace(/^0+(?=\d)/, '').replace(/\s/g, '');
}

/** Score catalog candidates against what OCR read. */
export function rankCandidates(briefs: CardBrief[], parsed: ParsedCardText): ScoredCandidate[] {
  const scored: ScoredCandidate[] = briefs.map((card) => {
    const reasons: string[] = [];
    let score = 0;

    if (parsed.name) {
      const nameScore = similarity(parsed.name, card.name);
      score += nameScore * 0.6;
      reasons.push(`name ${(nameScore * 100).toFixed(0)}%`);
    }

    if (parsed.localId) {
      if (normalizeLocalId(card.localId) === normalizeLocalId(parsed.localId)) {
        score += 0.4;
        reasons.push('number exact');
      }
    } else {
      // No number read: rescale so name alone can still reach 1.0.
      score = parsed.name ? score / 0.6 : 0;
    }

    return { card, score: Math.min(score, 1), reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/** A match is "confident" only when it clearly beats the runner-up. */
export function isConfidentMatch(ranked: ScoredCandidate[]): boolean {
  if (ranked.length === 0) return false;
  const [best, second] = ranked;
  if (best.score < 0.85) return false;
  if (second && best.score - second.score < 0.15) return false;
  return true;
}

export interface MatchOutcome {
  parsed: ParsedCardText;
  candidates: ScoredCandidate[];
  /** Set when exactly one candidate is trustworthy. */
  confidentCardId?: string;
}

/**
 * Full pipeline: parsed OCR text -> catalog search -> ranked candidates.
 * When a set total (e.g. the 102 in 4/102) was read, candidates are
 * re-checked against their set's official card count.
 */
export async function matchCard(parsed: ParsedCardText): Promise<MatchOutcome> {
  if (!parsed.name && !parsed.localId) {
    return { parsed, candidates: [] };
  }

  let briefs: CardBrief[] = [];
  if (parsed.name) {
    briefs = await searchCardsByName(parsed.name);
  }

  let ranked = rankCandidates(briefs, parsed).slice(0, 10);

  // Disambiguate same name + number across sets using the printed set size.
  if (parsed.setTotal && ranked.length > 1) {
    const withSets = await Promise.all(
      ranked.map(async (candidate) => {
        try {
          const full: Card = await getCard(candidate.card.id);
          const official = full.set?.cardCount?.official;
          if (official === parsed.setTotal) {
            return {
              ...candidate,
              score: Math.min(candidate.score + 0.2, 1),
              reasons: [...candidate.reasons, 'set size match'],
            };
          }
        } catch {
          // Network hiccup on one candidate should not sink the ranking.
        }
        return candidate;
      }),
    );
    ranked = withSets.sort((a, b) => b.score - a.score);
  }

  const confident = isConfidentMatch(ranked);
  return {
    parsed,
    candidates: ranked,
    confidentCardId: confident ? ranked[0].card.id : undefined,
  };
}

/**
 * Turns raw OCR lines into a structured query, then ranks catalog
 * candidates. Rule from the plan: never silently treat a low-confidence
 * match as the exact card — ambiguity is surfaced to the Confirm screen.
 */

import type { Card, CardBrief, ParsedCardText, ScoredCandidate } from '../types/card';
import { normalize, similarity } from '../utils/text';
import { getCard, getCardInSet, getSetSizes, searchCardsByName, setIdOf } from './tcgdex.service';

/** Collector number with a set total, e.g. "4/102" or "TG12/TG30". */
const COLLECTOR_NUMBER_RE = /\b([A-Z]{0,4}\d{1,3}[a-z]?)\s*\/\s*([A-Z]{0,4}\d{1,3})\b/;

/**
 * Promo number printed without a slash, e.g. "SWSH284", "SM60", "SVP 085".
 * Restricted to known promo prefixes so plain numbers (damage, "HP 120")
 * are never mistaken for a collector number. Longer prefixes come first.
 */
const PROMO_NUMBER_RE = /\b(SWSH|HGSS|SVP|SV|SM|XY|BW|DP)\s?(\d{1,3})\b/i;

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

/** Promo-style number typed on its own, e.g. "SWSH284", "25" or "TG12". */
const STANDALONE_NUMBER_RE = /^([A-Z]{0,5}\d{1,3}[a-z]?)$/i;

export interface CollectorNumber {
  localId: string;
  setTotal?: number;
}

/** Find a "number/total" collector number inside one OCR line. */
function matchCollectorNumber(line: string): CollectorNumber | null {
  const m = COLLECTOR_NUMBER_RE.exec(line);
  if (!m) return null;
  const total = parseInt(m[2].replace(/\D/g, ''), 10);
  return { localId: m[1], setTotal: Number.isNaN(total) ? undefined : total };
}

/**
 * Parse a collector number the user typed: "4/102", "TG12/TG30" or a
 * promo number without a slash ("SWSH284"). Returns null when it does
 * not look like a collector number.
 */
export function parseCollectorNumber(input: string): CollectorNumber | null {
  const text = input.trim();
  if (!text) return null;
  // Try as typed first (keeps a lowercase variant suffix like "4a"), then
  // uppercased so "tg12/tg30" is accepted too.
  const withSlash = matchCollectorNumber(text) ?? matchCollectorNumber(text.toUpperCase());
  if (withSlash) return withSlash;
  if (text.includes('/')) return null;
  const standalone = STANDALONE_NUMBER_RE.exec(text);
  return standalone ? { localId: standalone[1].toUpperCase() } : null;
}

/** Find a slashless promo number ("SWSH284", "SVP 085") inside one OCR line. */
function matchPromoNumber(line: string): CollectorNumber | null {
  const m = PROMO_NUMBER_RE.exec(line);
  return m ? { localId: `${m[1].toUpperCase()}${m[2]}` } : null;
}

/** Extract name + collector number from raw OCR lines. */
export function parseOcrLines(rawLines: string[]): ParsedCardText {
  const result: ParsedCardText = { rawLines };

  // Prefer a "number/total" anywhere on the card; fall back to a promo number.
  let number: CollectorNumber | null = null;
  for (const line of rawLines) {
    number = matchCollectorNumber(line);
    if (number) break;
  }
  if (!number) {
    for (const line of rawLines) {
      number = matchPromoNumber(line);
      if (number) break;
    }
  }
  if (number) {
    result.localId = number.localId;
    if (number.setTotal !== undefined) result.setTotal = number.setTotal;
  }

  const [name] = nameCandidates(rawLines);
  if (name) result.name = name;

  return result;
}

/**
 * Plausible card-name lines in the order to try them. Names are printed
 * near the top and always start with a capital letter, while OCR noise from
 * artwork and energy symbols ("ned", "car i") is usually lowercase, so
 * capitalised lines come first, each group in reading order.
 */
export function nameCandidates(rawLines: string[]): string[] {
  const plausible = [...new Set(rawLines.map((l) => l.trim()).filter(looksLikeName))];
  const capitalised = plausible.filter((l) => /^[A-Z]/.test(l));
  return [...capitalised, ...plausible.filter((l) => !/^[A-Z]/.test(l))];
}

/** How many catalog searches one card may use for name guesses. */
const MAX_NAME_ATTEMPTS = 8;

/** Words OCR puts in front of a name: stage labels, trainer names, misreads. */
function isNoiseWord(word: string): boolean {
  return (
    /^[A-Z0-9]{4,}$/.test(word) || // "STAGEZ", "BASIS"
    word.length <= 3 || // "My", "N.", "NS"
    /^(stage|basic|trainer|supporter|item|stadium)/i.test(word)
  );
}

/**
 * Spellings worth searching for one OCR name, most faithful first:
 * the line itself, a cleaned "ex" suffix, without a noisy first word, the
 * last word on its own, and a short prefix for a cut-off name.
 */
export function nameVariants(name: string): string[] {
  const clean = name.replace(/\s+/g, ' ').trim();
  const out = [clean];
  // "Mega Mawile ev" / "Gengar eX" / "Gouging Fire e" -> "... ex"; "Pikachuex" -> "Pikachu ex".
  const ex = clean.replace(/\s+(ev|ex|e x|e)$/i, ' ex').replace(/([a-z]{4,})ex$/, '$1 ex');
  out.push(ex);
  const words = ex.split(' ');
  const exSuffix = words[words.length - 1].toLowerCase() === 'ex';
  const core = exSuffix ? words.slice(0, -1) : words;
  if (core.length > 1 && isNoiseWord(core[0])) {
    out.push([...core.slice(1), ...(exSuffix ? ['ex'] : [])].join(' '));
  }
  if (core.length > 1) {
    const last = core[core.length - 1];
    if (last.length >= 4) out.push(last);
  }
  const first = core.find((w) => w.length >= 6 && /^[A-Za-z]/.test(w));
  if (first) out.push(first.slice(0, 5));
  return [...new Set(out.filter((v) => v.length >= 3))];
}

/** Search order for an OCR card: each guess's variants in turn, capped. */
export function searchOrder(first: string, guesses: string[]): string[] {
  const order = [first, ...guesses.filter((g) => g !== first)].flatMap(nameVariants);
  return [...new Set(order)].slice(0, MAX_NAME_ATTEMPTS);
}

/** At most this many sets are checked for one collector number. */
const MAX_NUMBER_SETS = 8;

async function briefsByNumber(localId: string, setTotal: number): Promise<CardBrief[]> {
  try {
    const sizes = await getSetSizes();
    const setIds = [...sizes].filter(([, n]) => n === setTotal).map(([id]) => id).slice(0, MAX_NUMBER_SETS);
    const found = await Promise.all(setIds.map((id) => getCardInSet(id, localId).catch(() => null)));
    return found.filter((b): b is CardBrief => b !== null);
  } catch {
    return [];
  }
}

function normalizeLocalId(id: string): string {
  // "004" -> "4", keep letter prefixes ("TG12" -> "tg12").
  return normalize(id).replace(/^0+(?=\d)/, '').replace(/\s/g, '');
}

/**
 * How much each signal is worth. A score is the weight earned divided by the
 * weight of the signals actually available, so a card whose number could not
 * be read can still reach 100% on name alone, and reprints that share a name
 * and number are split by set size and attack names instead of tying.
 */
const WEIGHTS = { name: 0.4, number: 0.3, setSize: 0.15, attacks: 0.15 };

/** Extra catalog facts that sharpen the ranking when they could be fetched. */
export interface RankingContext {
  /** Official card count per set id (see getSetSizes). */
  setSizes?: Map<string, number>;
  /** Full card records by id, for attack and ability names. */
  details?: Map<string, Card>;
}

/** Share of a card's attack/ability names that appear among the OCR lines. */
function attackOverlap(card: Card, rawLines: string[]): number {
  const names = [...(card.abilities ?? []), ...(card.attacks ?? [])]
    .map((a) => normalize(a.name))
    .filter((n) => n.length >= 4);
  if (names.length === 0) return 0;
  const lines = rawLines.map(normalize);
  const found = names.filter((n) => lines.some((l) => l.includes(n) || similarity(l, n) >= 0.8));
  return found.length / names.length;
}

/** Score catalog candidates against what OCR read. */
export function rankCandidates(
  briefs: CardBrief[],
  parsed: ParsedCardText,
  context: RankingContext = {},
): ScoredCandidate[] {
  // Set size and attacks only count when some candidate earns them, so an
  // OCR misread or a card with no readable attacks does not drag every
  // score down equally (which would only hide confident matches).
  const sizeMatches = (card: CardBrief) =>
    context.setSizes?.get(setIdOf(card)) === parsed.setTotal;
  const overlaps = new Map<string, number>();
  for (const card of briefs) {
    const detail = context.details?.get(card.id);
    if (detail) overlaps.set(card.id, attackOverlap(detail, parsed.rawLines));
  }
  const useSetSize = Boolean(parsed.setTotal && context.setSizes && briefs.some(sizeMatches));
  const useAttacks = [...overlaps.values()].some((o) => o > 0);
  const available =
    (parsed.name ? WEIGHTS.name : 0) +
    (parsed.localId ? WEIGHTS.number : 0) +
    (useSetSize ? WEIGHTS.setSize : 0) +
    (useAttacks ? WEIGHTS.attacks : 0);

  const scored: ScoredCandidate[] = briefs.map((card) => {
    const reasons: string[] = [];
    let earned = 0;

    if (parsed.name) {
      const nameScore = similarity(parsed.name, card.name);
      earned += nameScore * WEIGHTS.name;
      reasons.push(`name ${(nameScore * 100).toFixed(0)}%`);
    }

    if (parsed.localId && normalizeLocalId(card.localId) === normalizeLocalId(parsed.localId)) {
      earned += WEIGHTS.number;
      reasons.push('number exact');
    }

    if (useSetSize && sizeMatches(card)) {
      earned += WEIGHTS.setSize;
      reasons.push('set size match');
    }

    const overlap = overlaps.get(card.id) ?? 0;
    if (useAttacks && overlap > 0) {
      earned += overlap * WEIGHTS.attacks;
      reasons.push(`attacks ${(overlap * 100).toFixed(0)}%`);
    }

    return { card, score: available > 0 ? earned / available : 0, reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/** Below this gap, two candidates count as equally likely. */
const MARGIN = 0.15 - 1e-9;

/** A match is "confident" only when it clearly beats the runner-up. */
export function isConfidentMatch(ranked: ScoredCandidate[]): boolean {
  if (ranked.length === 0) return false;
  const [best, second] = ranked;
  if (best.score < 0.85) return false;
  if (second && best.score - second.score < MARGIN) return false;
  return true;
}

/**
 * Candidates worth showing first: everything within the confidence margin
 * of the best one. The rest are other printings the user can expand.
 */
export function splitStrongMatches(ranked: ScoredCandidate[]): {
  strong: ScoredCandidate[];
  others: ScoredCandidate[];
} {
  if (ranked.length === 0) return { strong: [], others: [] };
  const cutoff = ranked[0].score - MARGIN;
  const strong = ranked.filter((c) => c.score >= cutoff);
  return { strong, others: ranked.slice(strong.length) };
}

/** How many top candidates get their full record fetched for attack names. */
const DETAIL_FETCH_LIMIT = 8;
/** How many candidates the Confirm screen receives. */
const MAX_CANDIDATES = 25;

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
  // A name typed by hand is searched as it is. An OCR guess can be noisy
  // ("My Gyarados", "Mega Mawile ev") or an attack name ("Destructo-Press"),
  // so its variants and the next plausible lines are tried in turn, and the
  // first search the catalog answers wins.
  const guesses = nameCandidates(parsed.rawLines);
  const fromOcr = !!parsed.name && guesses.includes(parsed.name);
  const tries = parsed.name
    ? fromOcr
      ? searchOrder(parsed.name, guesses)
      : [parsed.name]
    : [];
  for (const attempt of tries) {
    const found = await searchCardsByName(attempt);
    if (found.length > 0) {
      briefs = found;
      parsed = { ...parsed, name: attempt };
      break;
    }
  }

  // A collector number with its set size ("050/182") points at a handful of
  // cards whatever the name says, so look it up in every set of that size.
  if (parsed.localId && parsed.setTotal) {
    const byNumber = await briefsByNumber(parsed.localId, parsed.setTotal);
    const known = new Set(briefs.map((b) => b.id));
    briefs = [...briefs, ...byNumber.filter((b) => !known.has(b.id))];
  }

  // Set sizes come from one cached catalog request, so every candidate is
  // checked, not just the first few. Without them the ranking still works.
  const context: RankingContext = {};
  if (parsed.setTotal && briefs.length > 1) {
    try {
      context.setSizes = await getSetSizes();
    } catch {
      // Ranking falls back to name + number.
    }
  }
  let ranked = rankCandidates(briefs, parsed, context);

  // Attack and ability names split reprints that share a name, number and
  // set size. Only the leading candidates are fetched to keep it quick.
  if (ranked.length > 1 && parsed.rawLines.length > 0) {
    const details = new Map<string, Card>();
    await Promise.all(
      ranked.slice(0, DETAIL_FETCH_LIMIT).map(async ({ card }) => {
        try {
          details.set(card.id, await getCard(card.id));
        } catch {
          // A network hiccup on one candidate should not sink the ranking.
        }
      }),
    );
    if (details.size > 0) {
      ranked = rankCandidates(briefs, parsed, { ...context, details });
    }
  }
  ranked = ranked.slice(0, MAX_CANDIDATES);

  const confident = isConfidentMatch(ranked);
  return {
    parsed,
    candidates: ranked,
    confidentCardId: confident ? ranked[0].card.id : undefined,
  };
}

/**
 * Types for the TCGdex REST API (https://tcgdex.dev).
 * Only the fields PokeWorth uses are modeled; everything else is optional
 * because the API omits fields that have no data for a given card.
 */

/** Compact card record returned by list/search endpoints. */
export interface CardBrief {
  id: string;
  localId: string;
  name: string;
  /** Base image URL without quality/extension suffix (may be missing). */
  image?: string;
}

export interface SetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: {
    official: number;
    total: number;
  };
}

/** Full set record from /v2/en/sets/{id}. */
export interface SetDetail extends SetBrief {
  releaseDate?: string;
  serie?: { id: string; name: string };
  cards: CardBrief[];
}

/** Which printings exist for a card. */
export interface CardVariants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  wPromo?: boolean;
}

/** A single price block, e.g. tcgplayer "holofoil" or cardmarket "avg30". */
export interface PriceDetail {
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
  low?: number;
  trend?: number;
  [key: string]: number | undefined;
}

/**
 * Provider pricing blob. Shapes differ by provider:
 * - Cardmarket: flat numbers ("avg", "trend", "avg30", "trend-holo", ...)
 * - TCGplayer: nested per-variant objects (often null entirely)
 */
export interface ProviderPricing {
  updated?: string;
  unit?: string;
  [key: string]: PriceDetail | string | number | null | undefined;
}

export interface CardPricing {
  tcgplayer?: ProviderPricing | null;
  cardmarket?: ProviderPricing | null;
}

/** Full card record from /v2/en/cards/{id}. */
export interface Card extends CardBrief {
  category?: string;
  rarity?: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  set?: SetBrief;
  variants?: CardVariants;
  pricing?: CardPricing;
  /** Printed attack and ability names; used to tell reprints apart. */
  attacks?: { name: string }[];
  abilities?: { name: string }[];
  /** e.g. "Basic", "Stage2". */
  stage?: string;
  /** One entry per printing, each with its own provider prices. */
  variants_detailed?: VariantDetail[];
}

/** One `variants_detailed` entry (only the fields PokeWorth reads). */
export interface VariantDetail {
  type?: string;
  subtype?: string;
  stamp?: string[];
  variantId?: string;
  pricing?: { cardmarket?: ProviderPricing | null; tcgplayer?: ProviderPricing | null };
}

/** What we managed to read off a photographed card. */
export interface ParsedCardText {
  /** Best guess at the card name. */
  name?: string;
  /** Collector number before the slash, e.g. "4" in 4/102. */
  localId?: string;
  /** Printed set size after the slash, e.g. 102 in 4/102. */
  setTotal?: number;
  /** Hit points read from the top of the card, e.g. 140; narrows the catalog search. */
  hp?: number;
  /** Raw OCR lines, kept for debugging and manual correction. */
  rawLines: string[];
}

/** A catalog candidate with its match score (0..1). */
export interface ScoredCandidate {
  card: CardBrief;
  score: number;
  /** Human-readable reasons, e.g. ["name 0.92", "number exact"]. */
  reasons: string[];
}

/** One normalized price line ready for display. */
export interface DisplayPrice {
  provider: 'TCGplayer' | 'Cardmarket';
  variant: string;
  label: string;
  amount: number;
  currency: string;
  updated?: string;
}

/** Entry saved in local scan history. */
export interface RecentScan {
  cardId: string;
  name: string;
  setName?: string;
  localId?: string;
  image?: string;
  scannedAt: string;
}

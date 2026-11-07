/**
 * Collection rules, kept pure (no storage, no React) so they can be tested
 * offline. Saved as `pokeworth.collection.v1` by collection.service.ts.
 *
 * One entry = one printing of one card in one portfolio, with a quantity.
 * Several portfolios are supported from v1; the UI starts with "Main".
 */

export interface PriceSnapshot {
  amount: number;
  currency: string;
  /** "Your value" is a value the user typed for a graded copy (decision 2). */
  provider: 'TCGplayer' | 'Cardmarket' | 'Your value';
  /** Provider's own date for the price. */
  updated?: string;
  /** Cardmarket change vs its 7- / 30-day average, in percent (market movers). */
  vs7d?: number;
  vs30d?: number;
}

/** Card facts copied in so the Portfolio renders without a network call. */
export interface CardSnapshot {
  name: string;
  localId: string;
  /** e.g. "4/102" when the set size is known. */
  number?: string;
  setId?: string;
  setName?: string;
  rarity?: string;
  image?: string;
}

export interface CollectionEntry {
  id: string;
  portfolioId: string;
  cardId: string;
  printingId: string;
  printingLabel: string;
  quantity: number;
  condition: string;
  addedAt: string;
  card: CardSnapshot;
  price?: PriceSnapshot;
  /** Set for a graded copy; such entries are never merged or repriced. */
  graded?: Grading;
}

/** A graded (slabbed) copy, entered by the user. */
export interface Grading {
  company: string;
  grade: string;
  cert?: string;
  /** Unique per graded copy; part of the entry id. */
  slot: string;
}

export const GRADING_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'ACE'] as const;
export const GRADES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5', '4', '3', '2', '1'] as const;

export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
}

export interface CollectionState {
  version: 1;
  portfolios: Portfolio[];
  activePortfolioId: string;
  entries: CollectionEntry[];
  /** Card ids starred by the user. */
  favorites: string[];
}

export const MAIN_PORTFOLIO_ID = 'main';
export const DEFAULT_CONDITION = 'Near Mint';
const MAX_QUANTITY = 999;

export function emptyCollection(now = new Date().toISOString()): CollectionState {
  return {
    version: 1,
    portfolios: [{ id: MAIN_PORTFOLIO_ID, name: 'Main', createdAt: now }],
    activePortfolioId: MAIN_PORTFOLIO_ID,
    entries: [],
    favorites: [],
  };
}

function isEntry(e: unknown): e is CollectionEntry {
  if (!e || typeof e !== 'object') return false;
  const x = e as Partial<CollectionEntry>;
  return (
    typeof x.id === 'string' &&
    typeof x.portfolioId === 'string' &&
    typeof x.cardId === 'string' &&
    typeof x.printingId === 'string' &&
    typeof x.quantity === 'number' &&
    x.quantity > 0 &&
    !!x.card &&
    typeof x.card.name === 'string'
  );
}

/**
 * Read stored JSON. Anything unreadable gives an empty collection instead of
 * a crash (AC-P5.1); individual broken entries are dropped.
 */
export function parseCollection(raw: string | null | undefined): CollectionState {
  if (!raw) return emptyCollection();
  try {
    const data = JSON.parse(raw) as Partial<CollectionState>;
    if (!data || data.version !== 1 || !Array.isArray(data.portfolios)) return emptyCollection();
    const portfolios = data.portfolios.filter(
      (p): p is Portfolio => !!p && typeof p.id === 'string' && typeof p.name === 'string',
    );
    if (!portfolios.some((p) => p.id === MAIN_PORTFOLIO_ID)) {
      portfolios.unshift(emptyCollection().portfolios[0]);
    }
    const ids = new Set(portfolios.map((p) => p.id));
    return {
      version: 1,
      portfolios,
      activePortfolioId:
        typeof data.activePortfolioId === 'string' && ids.has(data.activePortfolioId)
          ? data.activePortfolioId
          : MAIN_PORTFOLIO_ID,
      entries: (Array.isArray(data.entries) ? data.entries : []).filter(
        (e): e is CollectionEntry => isEntry(e) && ids.has(e.portfolioId),
      ),
      favorites: Array.isArray(data.favorites)
        ? data.favorites.filter((f): f is string => typeof f === 'string')
        : [],
    };
  } catch {
    return emptyCollection();
  }
}

export function entryId(portfolioId: string, cardId: string, printingId: string): string {
  return `${portfolioId}|${cardId}|${printingId}`;
}

/** What the UI passes in to add or change a printing. */
export interface EntryInput {
  cardId: string;
  printingId: string;
  printingLabel: string;
  card: CardSnapshot;
  price?: PriceSnapshot;
  portfolioId?: string;
}

/** Quantity of one printing in a portfolio (0 when not owned). */
export function quantityOf(
  state: CollectionState,
  cardId: string,
  printingId: string,
  portfolioId = state.activePortfolioId,
): number {
  return state.entries.find((e) => e.id === entryId(portfolioId, cardId, printingId))?.quantity ?? 0;
}

/** Total copies of a card across printings in a portfolio. */
export function cardQuantity(
  state: CollectionState,
  cardId: string,
  portfolioId = state.activePortfolioId,
): number {
  return state.entries
    .filter((e) => e.portfolioId === portfolioId && e.cardId === cardId)
    .reduce((n, e) => n + e.quantity, 0);
}

/**
 * Set the quantity of one printing. 0 removes it; a new printing is added
 * with today's price; an existing one keeps its date added and gets the
 * newer price when one is given.
 */
export function setQuantity(
  state: CollectionState,
  input: EntryInput,
  quantity: number,
  now = new Date().toISOString(),
): CollectionState {
  const portfolioId = input.portfolioId ?? state.activePortfolioId;
  const id = entryId(portfolioId, input.cardId, input.printingId);
  const qty = Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)));
  const existing = state.entries.find((e) => e.id === id);
  if (qty === 0) {
    return existing ? { ...state, entries: state.entries.filter((e) => e.id !== id) } : state;
  }
  if (existing) {
    return {
      ...state,
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, quantity: qty, card: input.card, price: input.price ?? e.price } : e,
      ),
    };
  }
  const entry: CollectionEntry = {
    id,
    portfolioId,
    cardId: input.cardId,
    printingId: input.printingId,
    printingLabel: input.printingLabel,
    quantity: qty,
    condition: DEFAULT_CONDITION,
    addedAt: now,
    card: input.card,
    price: input.price,
  };
  return { ...state, entries: [entry, ...state.entries] };
}

/** Add one copy (adding the same card and printing again raises the quantity). */
export function addOne(state: CollectionState, input: EntryInput, now?: string): CollectionState {
  const current = quantityOf(state, input.cardId, input.printingId, input.portfolioId ?? state.activePortfolioId);
  return setQuantity(state, input, current + 1, now);
}

/** One line of an "add many" (a binder page): an entry and how many copies to add. */
export interface AddManyItem {
  input: EntryInput;
  quantity: number;
}

/**
 * Add several cards at once. Cards already in the portfolio get their
 * quantity raised (like the + button); duplicates in `items` add up.
 */
export function addMany(state: CollectionState, items: AddManyItem[], now?: string): CollectionState {
  return items.reduce((s, { input, quantity }) => {
    const current = quantityOf(s, input.cardId, input.printingId, input.portfolioId ?? s.activePortfolioId);
    return setQuantity(s, input, current + Math.max(1, Math.round(quantity)), now);
  }, state);
}

export function removeEntries(state: CollectionState, ids: string[]): CollectionState {
  const drop = new Set(ids);
  return { ...state, entries: state.entries.filter((e) => !drop.has(e.id)) };
}

function gradedEntryId(portfolioId: string, cardId: string, slot: string): string {
  return `${portfolioId}|${cardId}|graded:${slot}`;
}

/** Move entries to another portfolio, merging raw quantities with what is there. */
export function moveEntries(state: CollectionState, ids: string[], toPortfolioId: string): CollectionState {
  if (!state.portfolios.some((p) => p.id === toPortfolioId)) return state;
  const moving = new Set(ids);
  let next: CollectionState = { ...state, entries: state.entries.filter((e) => !moving.has(e.id)) };
  for (const e of state.entries.filter((x) => moving.has(x.id) && x.portfolioId !== toPortfolioId)) {
    if (e.graded) {
      // Each graded copy is unique: it moves as it is, never merged.
      const id = gradedEntryId(toPortfolioId, e.cardId, e.graded.slot);
      next = { ...next, entries: [{ ...e, id, portfolioId: toPortfolioId }, ...next.entries] };
      continue;
    }
    const targetId = entryId(toPortfolioId, e.cardId, e.printingId);
    const target = next.entries.find((x) => x.id === targetId);
    next = target
      ? {
          ...next,
          entries: next.entries.map((x) =>
            x.id === targetId ? { ...x, quantity: Math.min(MAX_QUANTITY, x.quantity + e.quantity) } : x,
          ),
        }
      : { ...next, entries: [{ ...e, id: targetId, portfolioId: toPortfolioId }, ...next.entries] };
  }
  // Entries already in the target portfolio stay where they were.
  const stayed = state.entries.filter((x) => moving.has(x.id) && x.portfolioId === toPortfolioId);
  return { ...next, entries: [...stayed, ...next.entries] };
}

export function createPortfolio(
  state: CollectionState,
  name: string,
  now = new Date().toISOString(),
): CollectionState {
  const clean = name.trim().slice(0, 40);
  if (!clean) return state;
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portfolio';
  let id = base;
  for (let i = 2; state.portfolios.some((p) => p.id === id); i++) id = `${base}-${i}`;
  return {
    ...state,
    portfolios: [...state.portfolios, { id, name: clean, createdAt: now }],
    activePortfolioId: id,
  };
}

export function setActivePortfolio(state: CollectionState, id: string): CollectionState {
  return state.portfolios.some((p) => p.id === id) ? { ...state, activePortfolioId: id } : state;
}

export function toggleFavorite(state: CollectionState, cardId: string): CollectionState {
  return state.favorites.includes(cardId)
    ? { ...state, favorites: state.favorites.filter((f) => f !== cardId) }
    : { ...state, favorites: [cardId, ...state.favorites] };
}

/** Replace stored prices for one card's printings (pull-to-refresh). */
export function updatePrices(
  state: CollectionState,
  cardId: string,
  prices: Record<string, PriceSnapshot | undefined>,
): CollectionState {
  return {
    ...state,
    entries: state.entries.map((e) =>
      // Graded copies keep the value the user entered.
      !e.graded && e.cardId === cardId && e.printingId in prices ? { ...e, price: prices[e.printingId] } : e,
    ),
  };
}

/** What the "Add a graded card" form produces. */
export interface GradedInput {
  cardId: string;
  printingId: string;
  printingLabel: string;
  card: CardSnapshot;
  company: string;
  grade: string;
  cert?: string;
  /** The user's own value; optional. */
  value?: { amount: number; currency: string };
  portfolioId?: string;
}

export type GradedErrors = Partial<Record<'company' | 'grade' | 'cert' | 'value', string>>;

/** Check the form before saving. Returns an empty object when it is fine. */
export function validateGraded(state: CollectionState, input: GradedInput, valueText: string): GradedErrors {
  const errors: GradedErrors = {};
  if (!input.company.trim()) errors.company = 'Choose who graded the card.';
  if (!input.grade.trim()) errors.grade = 'Choose the grade on the label.';
  const cert = input.cert?.trim();
  if (cert && !/^[A-Za-z0-9-]{4,20}$/.test(cert)) errors.cert = 'Use the 4–20 letters or digits from the label.';
  if (
    cert &&
    state.entries.some((e) => e.graded && e.graded.company === input.company && e.graded.cert === cert)
  ) {
    errors.cert = `This ${input.company} certificate is already in your collection.`;
  }
  if (valueText.trim()) {
    const n = Number(valueText.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) errors.value = 'Enter a value above 0, or leave it empty.';
  }
  return errors;
}

/** Add one graded copy. `slot` makes it unique (pass a fixed one in tests). */
export function addGraded(
  state: CollectionState,
  input: GradedInput,
  now = new Date().toISOString(),
  slot = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
): CollectionState {
  const portfolioId = input.portfolioId ?? state.activePortfolioId;
  const grading: Grading = {
    company: input.company.trim(),
    grade: input.grade.trim(),
    cert: input.cert?.trim() || undefined,
    slot,
  };
  const entry: CollectionEntry = {
    id: gradedEntryId(portfolioId, input.cardId, slot),
    portfolioId,
    cardId: input.cardId,
    printingId: input.printingId,
    printingLabel: input.printingLabel,
    quantity: 1,
    condition: `${grading.company} ${grading.grade}`,
    addedAt: now,
    card: input.card,
    graded: grading,
    price: input.value
      ? { amount: Math.round(input.value.amount * 100) / 100, currency: input.value.currency, provider: 'Your value', updated: now.slice(0, 10) }
      : undefined,
  };
  return { ...state, entries: [entry, ...state.entries] };
}

/** Graded copies of one card in a portfolio. */
export function gradedOf(state: CollectionState, cardId: string, portfolioId = state.activePortfolioId): CollectionEntry[] {
  return state.entries.filter((e) => e.graded && e.cardId === cardId && e.portfolioId === portfolioId);
}

/** Raw (ungraded) copies of a card in a portfolio. */
export function rawQuantity(state: CollectionState, cardId: string, portfolioId = state.activePortfolioId): number {
  return state.entries
    .filter((e) => !e.graded && e.portfolioId === portfolioId && e.cardId === cardId)
    .reduce((n, e) => n + e.quantity, 0);
}

export function entriesIn(state: CollectionState, portfolioId = state.activePortfolioId): CollectionEntry[] {
  return state.entries.filter((e) => e.portfolioId === portfolioId);
}

export interface Totals {
  /** Sum of quantity × price per currency, e.g. { USD: 1012.4, EUR: 3.1 }. */
  byCurrency: Record<string, number>;
  /** Copies counted in the totals. */
  pricedCopies: number;
  /** Copies left out because they have no price. */
  unpricedCopies: number;
  copies: number;
}

/** Totals per currency; prices in different currencies are never added together. */
export function totals(entries: CollectionEntry[]): Totals {
  const byCurrency: Record<string, number> = {};
  let pricedCopies = 0;
  let unpricedCopies = 0;
  for (const e of entries) {
    if (e.price && e.price.amount > 0) {
      byCurrency[e.price.currency] = (byCurrency[e.price.currency] ?? 0) + e.price.amount * e.quantity;
      pricedCopies += e.quantity;
    } else {
      unpricedCopies += e.quantity;
    }
  }
  for (const c of Object.keys(byCurrency)) byCurrency[c] = Math.round(byCurrency[c] * 100) / 100;
  return { byCurrency, pricedCopies, unpricedCopies, copies: pricedCopies + unpricedCopies };
}

/**
 * Highest value first (quantity × price). Pass `toUsd` to compare across
 * currencies; without it raw amounts are compared.
 */
export function byValue(
  entries: CollectionEntry[],
  toUsd: (amount: number, currency: string) => number = (a) => a,
): CollectionEntry[] {
  const value = (e: CollectionEntry) => (e.price ? toUsd(e.price.amount * e.quantity, e.price.currency) : -1);
  return [...entries].sort((a, b) => value(b) - value(a));
}

function csvCell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with one row per entry, for Export. */
export function toCsv(state: CollectionState, portfolioId = state.activePortfolioId): string {
  const portfolio = state.portfolios.find((p) => p.id === portfolioId)?.name ?? portfolioId;
  const header = [
    'Portfolio', 'Card', 'Set', 'Number', 'Rarity', 'Printing', 'Condition', 'Grader', 'Grade',
    'Cert', 'Quantity', 'Unit price', 'Currency', 'Price source', 'Price date', 'Total', 'Card id',
    'Added',
  ];
  const rows = entriesIn(state, portfolioId).map((e) => [
    portfolio,
    e.card.name,
    e.card.setName,
    e.card.number ?? e.card.localId,
    e.card.rarity,
    e.printingLabel,
    e.condition,
    e.graded?.company,
    e.graded?.grade,
    e.graded?.cert,
    e.quantity,
    e.price?.amount,
    e.price?.currency,
    e.price?.provider,
    e.price?.updated?.slice(0, 10),
    e.price ? Math.round(e.price.amount * e.quantity * 100) / 100 : undefined,
    e.cardId,
    e.addedAt.slice(0, 10),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

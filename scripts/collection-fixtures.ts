/**
 * Offline fixtures for the collection model (no storage, no network).
 * Run: npx tsx scripts/collection-fixtures.ts
 */
import {
  addOne,
  byValue,
  cardQuantity,
  createPortfolio,
  emptyCollection,
  entriesIn,
  moveEntries,
  parseCollection,
  quantityOf,
  removeEntries,
  setQuantity,
  toCsv,
  toggleFavorite,
  totals,
  updatePrices,
  type EntryInput,
} from '../src/services/collection.model';

const NOW = '2026-11-07T12:00:00.000Z';
const charizardHolo: EntryInput = {
  cardId: 'base1-4',
  printingId: 'unl',
  printingLabel: 'Holofoil',
  card: { name: 'Charizard', localId: '4', number: '4/102', setId: 'base1', setName: 'Base Set', rarity: 'Rare' },
  price: { amount: 987.13, currency: 'USD', provider: 'TCGplayer', updated: '2026-11-07' },
};
const charizard1st: EntryInput = {
  ...charizardHolo,
  printingId: '1st',
  printingLabel: 'Holofoil · Shadowless · 1st Edition',
  price: { amount: 3489.25, currency: 'EUR', provider: 'Cardmarket' },
};
const gengar: EntryInput = {
  cardId: 'xyz-1',
  printingId: 'n',
  printingLabel: 'Normal',
  card: { name: 'Gengar, "Cosmos"', localId: '50' },
};

let failed = 0;
let total = 0;
function check(label: string, ok: boolean, detail = '') {
  total++;
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

let s = emptyCollection(NOW);
check('starts with one portfolio, Main, active', s.portfolios.length === 1 && s.activePortfolioId === 'main');

s = addOne(s, charizardHolo, NOW);
s = addOne(s, charizardHolo, NOW);
check('adding the same card and printing again raises the quantity (AC-P5.2)',
  quantityOf(s, 'base1-4', 'unl') === 2 && s.entries.length === 1);

s = setQuantity(s, charizard1st, 1, NOW);
check('a second printing is its own entry', s.entries.length === 2 && cardQuantity(s, 'base1-4') === 3);

s = setQuantity(s, gengar, 4, NOW);
const t = totals(entriesIn(s));
check('totals per currency, never mixed', t.byCurrency.USD === 1974.26 && t.byCurrency.EUR === 3489.25,
  JSON.stringify(t.byCurrency));
check('unpriced copies are counted and left out (AC-P5.4)', t.unpricedCopies === 4 && t.pricedCopies === 3,
  JSON.stringify(t));

check('most valuable first, unpriced last',
  byValue(entriesIn(s)).map((e) => e.printingId).join(',') === '1st,unl,n',
  byValue(entriesIn(s)).map((e) => e.printingId).join(','));

s = setQuantity(s, gengar, 0, NOW);
check('quantity 0 removes the entry', quantityOf(s, 'xyz-1', 'n') === 0 && s.entries.length === 2);

s = setQuantity(s, charizardHolo, 5000, NOW);
check('quantity is capped at 999', quantityOf(s, 'base1-4', 'unl') === 999);
s = setQuantity(s, charizardHolo, 2, NOW);

s = updatePrices(s, 'base1-4', { unl: { amount: 1000, currency: 'USD', provider: 'TCGplayer', updated: '2026-11-08' } });
check('price refresh updates only the named printing',
  s.entries.find((e) => e.printingId === 'unl')?.price?.amount === 1000 &&
    s.entries.find((e) => e.printingId === '1st')?.price?.amount === 3489.25);

s = createPortfolio(s, 'For Trade', NOW);
check('creating a portfolio makes it active with a slug id', s.activePortfolioId === 'for-trade' && s.portfolios.length === 2);
s = createPortfolio(s, 'For Trade', NOW);
check('duplicate names get a unique id', s.portfolios.some((p) => p.id === 'for-trade-2'));

s = setQuantity(s, { ...charizardHolo, portfolioId: 'for-trade' }, 1, NOW);
const mainHolo = 'main|base1-4|unl';
s = moveEntries(s, [mainHolo], 'for-trade');
check('moving merges quantities into the target',
  quantityOf(s, 'base1-4', 'unl', 'for-trade') === 3 && quantityOf(s, 'base1-4', 'unl', 'main') === 0,
  JSON.stringify(s.entries.map((e) => [e.id, e.quantity])));

s = removeEntries(s, ['main|base1-4|1st']);
check('remove drops the entry', entriesIn(s, 'main').length === 0);

s = toggleFavorite(s, 'base1-4');
check('favourite toggles on', s.favorites.includes('base1-4'));
s = toggleFavorite(s, 'base1-4');
check('favourite toggles off', !s.favorites.includes('base1-4'));

const round = parseCollection(JSON.stringify(s));
check('save and load round-trips (AC-P5.6)', JSON.stringify(round) === JSON.stringify(s));
check('corrupt JSON gives an empty collection (AC-P5.1)', parseCollection('{oops').entries.length === 0);
check('wrong version gives an empty collection', parseCollection('{"version":2}').portfolios[0].id === 'main');
check('broken entries are dropped, good ones kept',
  parseCollection(JSON.stringify({ ...s, entries: [...s.entries, { id: 1 }, null] })).entries.length === s.entries.length);
check('unknown active portfolio falls back to Main',
  parseCollection(JSON.stringify({ ...s, activePortfolioId: 'gone' })).activePortfolioId === 'main');

const csvState = setQuantity(emptyCollection(NOW), gengar, 2, NOW);
const csv = toCsv(csvState).split('\n');
check('CSV has a header and quotes cells with commas or quotes',
  csv[0].startsWith('Portfolio,Card,Set') && csv[1].includes('"Gengar, ""Cosmos"""'), csv[1]);

console.log(`\n${total - failed}/${total} collection fixtures passed.`);
if (failed > 0) process.exit(1);

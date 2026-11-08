/**
 * Offline fixtures for the backup file rules (no storage, no network).
 * Run: npx -y tsx@4.20.6 scripts/backup-fixtures.ts
 */
import {
  backupFileName,
  buildBackup,
  mergeBackup,
  parseBackup,
  summarizeBackup,
  type BackupData,
} from '../src/services/backup.model';
import { addOne, createPortfolio, emptyCollection, setQuantity, toggleFavorite, type EntryInput } from '../src/services/collection.model';
import { addCardPoint, emptyHistory } from '../src/services/history.model';

let total = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  total++;
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const NOW = '2026-11-08T10:00:00.000Z';
const charizard: EntryInput = {
  cardId: 'base1-4',
  printingId: 'unl',
  printingLabel: 'Holofoil',
  card: { name: 'Charizard', localId: '4' },
  price: { amount: 900, currency: 'USD', provider: 'TCGplayer' },
};
const pikachu: EntryInput = {
  cardId: 'base1-58',
  printingId: 'unl',
  printingLabel: 'Normal',
  card: { name: 'Pikachu', localId: '58' },
  price: { amount: 5, currency: 'USD', provider: 'TCGplayer' },
};

let col = addOne(emptyCollection(NOW), charizard, NOW);
col = setQuantity(col, pikachu, 3, NOW);
col = toggleFavorite(col, 'base1-4');
col = createPortfolio(col, 'Trades', NOW);
const history = addCardPoint(emptyHistory(), 'base1-4|unl', { d: '2026-11-08', v: 900, c: 'USD' });
const mine: BackupData = { collection: col, history, currency: 'EUR' };

// Round trip
const file = buildBackup(mine, NOW);
const back = parseBackup(file);
check('round trip is ok', back.ok);
if (back.ok) {
  check('entries survive', back.data.collection.entries.length === 2);
  check('quantity survives', back.data.collection.entries.find((e) => e.cardId === 'base1-58')?.quantity === 3);
  check('portfolios survive', back.data.collection.portfolios.length === 2);
  check('favourites survive', back.data.collection.favorites[0] === 'base1-4');
  check('history survives', back.data.history.cards['base1-4|unl']?.length === 1);
  check('currency survives', back.data.currency === 'EUR');
  const s = summarizeBackup(back.data);
  check('summary counts copies', s.entries === 2 && s.copies === 4 && s.portfolios === 2 && s.historySeries === 1);
}

// Bad input
check('empty file refused', !parseBackup('').ok);
check('not json refused', !parseBackup('hello').ok);
check('other json refused', !parseBackup('{"a":1}').ok);
check('newer version refused', !parseBackup('{"format":"pokeworth-backup","version":99,"collection":{}}').ok);
check('no collection refused', !parseBackup('{"format":"pokeworth-backup","version":1}').ok);
const odd = parseBackup(JSON.stringify({ format: 'pokeworth-backup', version: 1, collection: { version: 1, portfolios: [], entries: [{ junk: true }] }, currency: 'GBP' }));
check('broken entries dropped, Main added', odd.ok && odd.data.collection.entries.length === 0 && odd.data.collection.portfolios[0].id === 'main');
check('unknown currency ignored', odd.ok && odd.data.currency === undefined);

// Merge
let other = addOne(emptyCollection(NOW), charizard, NOW);
other = setQuantity(other, charizard, 5, NOW); // bigger than the phone's 1
other = setQuantity(other, { ...pikachu, cardId: 'base1-1', card: { name: 'Alakazam', localId: '1' } }, 2, NOW);
const theirs: BackupData = {
  collection: other,
  history: addCardPoint(addCardPoint(emptyHistory(), 'base1-4|unl', { d: '2026-10-01', v: 800, c: 'USD' }), 'base1-1|unl', { d: '2026-11-01', v: 3, c: 'USD' }),
  currency: 'USD',
};
const merged = mergeBackup(mine, theirs);
check('merge keeps larger quantity', merged.collection.entries.find((e) => e.cardId === 'base1-4')?.quantity === 5);
check('merge keeps phone-only card', merged.collection.entries.some((e) => e.cardId === 'base1-58'));
check('merge adds backup-only card', merged.collection.entries.some((e) => e.cardId === 'base1-1'));
check('merge never double counts', merged.collection.entries.length === 3);
check('merge keeps both portfolios', merged.collection.portfolios.length === 2);
check('merge keeps phone history for shared card', merged.history.cards['base1-4|unl'][0].v === 900);
check('merge adds history the phone lacks', !!merged.history.cards['base1-1|unl']);
check('merge keeps phone currency', merged.currency === 'EUR');

check('file name', backupFileName('2026-11-08') === 'pokeworth-backup-2026-11-08.json');

console.log(`\n${total - failed}/${total} backup fixtures passed.`);
if (failed > 0) process.exit(1);

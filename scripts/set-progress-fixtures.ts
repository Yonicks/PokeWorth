/**
 * Offline fixtures for set completion (no storage, no network).
 * Run: npx -y tsx@4.20.6 scripts/set-progress-fixtures.ts
 */
import { addGraded, addOne, createPortfolio, emptyCollection, setActivePortfolio, type EntryInput } from '../src/services/collection.model';
import { filterSetCards, ownedCardIds, ownedPerSet, progressOf } from '../src/services/set-progress.model';

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
const card = (cardId: string, setId: string, printingId = 'normal'): EntryInput => ({
  cardId,
  printingId,
  printingLabel: printingId,
  card: { name: cardId, localId: '1', setId },
});

let s = emptyCollection(NOW);
s = addOne(s, card('base1-4', 'base1'), NOW);
s = addOne(s, card('base1-4', 'base1', 'holo'), NOW); // same card, other printing
s = addOne(s, card('base1-58', 'base1'), NOW);
s = addOne(s, card('sv06-1', 'sv06'), NOW);
s = addGraded(s, { cardId: 'base1-7', printingId: 'holo', printingLabel: 'Holo', card: { name: 'x', localId: '7', setId: 'base1' }, company: 'PSA', grade: '10' }, NOW, 's1');

check('owned ids count distinct cards', ownedCardIds(s).size === 4);
check('a graded copy counts as owned', ownedCardIds(s).has('base1-7'));
const per = ownedPerSet(s);
check('two printings of one card count once', per.base1 === 3 && per.sv06 === 1, JSON.stringify(per));

const p = progressOf(3, 102);
check('progress percent rounds', p.pct === 3 && p.owned === 3 && p.total === 102);
check('progress never exceeds 100', progressOf(200, 165).pct === 100 && progressOf(200, 165).owned === 165);
check('empty set has no division by zero', progressOf(0, 0).pct === 0);

const cards = [{ id: 'base1-4' }, { id: 'base1-5' }, { id: 'base1-7' }];
const own = ownedCardIds(s);
check('filter owned', filterSetCards(cards, own, 'owned').map((c) => c.id).join() === 'base1-4,base1-7');
check('filter missing', filterSetCards(cards, own, 'missing').map((c) => c.id).join() === 'base1-5');
check('filter all', filterSetCards(cards, own, 'all').length === 3);

// Other portfolios do not count
let t = createPortfolio(s, 'Trades', NOW);
t = addOne(t, card('base1-99', 'base1'), NOW);
t = setActivePortfolio(t, 'main');
check('only the active portfolio counts', !ownedCardIds(t).has('base1-99') && ownedPerSet(t).base1 === 3);

console.log(`\n${total - failed}/${total} set progress fixtures passed.`);
if (failed > 0) process.exit(1);

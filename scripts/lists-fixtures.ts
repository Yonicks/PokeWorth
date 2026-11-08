/**
 * Offline fixtures for the trade and want lists (no storage, no network).
 * Run: npx -y tsx@4.20.6 scripts/lists-fixtures.ts
 */
import { addGraded, addOne, emptyCollection, setQuantity, toggleFavorite, type EntryInput } from '../src/services/collection.model';
import { listText, listTotals, tradeLines, wantIds } from '../src/services/lists.model';

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
const e = (cardId: string, name: string, amount?: number, currency = 'USD', printing = 'Normal'): EntryInput => ({
  cardId,
  printingId: printing.toLowerCase(),
  printingLabel: printing,
  card: { name, localId: '4', number: '4/102', setName: 'Base Set' },
  price: amount ? { amount, currency, provider: 'TCGplayer' } : undefined,
});

let s = emptyCollection(NOW);
s = setQuantity(s, e('a', 'Pikachu', 5), 4, NOW); // 3 spare, 15
s = setQuantity(s, e('b', 'Charizard', 900, 'USD', 'Holofoil'), 2, NOW); // 1 spare, 900
s = addOne(s, e('c', 'Single', 50), NOW); // nothing spare
s = setQuantity(s, e('d', 'Cheap EU', 2, 'EUR'), 3, NOW);
s = setQuantity(s, e('f', 'No price'), 2, NOW);
s = addGraded(s, { cardId: 'g', printingId: 'x', printingLabel: 'Holo', card: { name: 'Slab', localId: '1' }, company: 'PSA', grade: '10' }, NOW, 's1');

const lines = tradeLines(s);
check('only cards with 2 or more copies are listed', lines.length === 4, lines.map((l) => l.name).join());
check('spare = quantity minus one', lines.find((l) => l.name === 'Pikachu')?.qty === 3);
check('highest spare value first, unpriced last', lines[0].name === 'Charizard' && lines[lines.length - 1].name === 'No price', lines.map((l) => l.name).join());
check('graded cards are never spare', !lines.some((l) => l.name === 'Slab'));

const totals = listTotals(lines);
check('totals per currency, never mixed', totals.USD === 915 && totals.EUR === 4, JSON.stringify(totals));

const text = listText('Trade list — Main', lines);
check('text has the title and one line per card', text.split('\n')[0] === 'Trade list — Main' && text.split('\n').length === 1 + 4 + 1);
check('text line format', text.includes('3× Pikachu · Base Set #4/102 — $5.00'), text);
check('text names a non-normal printing', text.includes('Charizard · Base Set #4/102 · Holofoil'));
check('text ends with the total', /Total: \$915\.00 \+ €4\.00/.test(text), text);
check('empty list says so', listText('Want list', []).endsWith('(empty)'));

let w = toggleFavorite(toggleFavorite(toggleFavorite(emptyCollection(NOW), 'a'), 'z'), 'y');
w = addOne(w, e('a', 'Pikachu', 5), NOW);
check('want list = favourites you do not own', wantIds(w).join() === 'y,z' || wantIds(w).join() === 'z,y', wantIds(w).join());

console.log(`\n${total - failed}/${total} list fixtures passed.`);
if (failed > 0) process.exit(1);

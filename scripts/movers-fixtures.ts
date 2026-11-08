/**
 * Offline fixtures for price movers (no storage, no network).
 * Run: npx -y tsx@4.20.6 scripts/movers-fixtures.ts
 */
import { addOne, emptyCollection, entriesIn, setQuantity, type EntryInput } from '../src/services/collection.model';
import { addCardPoint, emptyHistory } from '../src/services/history.model';
import { cardMovers, changeOver } from '../src/services/movers.model';

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

const TODAY = '2026-11-08';
const pts = [
  { d: '2026-10-01', v: 100 },
  { d: '2026-10-20', v: 110 },
  { d: '2026-11-02', v: 120 },
  { d: '2026-11-08', v: 132 },
];

const w = changeOver(pts, 7, TODAY);
check('7 days compares with the newest point at least 7 days old', !!w && w.from === '2026-10-20' && Math.abs(w.pct - 20) < 1e-9 && Math.abs(w.amount - 22) < 1e-9, JSON.stringify(w));
const m = changeOver(pts, 30, TODAY);
check('30 days reaches back to the 1st', !!m && m.from === '2026-10-01' && Math.abs(m.pct - 32) < 1e-9, JSON.stringify(m));
check('no point old enough gives no change', changeOver([{ d: '2026-11-05', v: 5 }, { d: '2026-11-08', v: 6 }], 7, TODAY) === undefined);
check('a single point gives no change', changeOver([{ d: '2026-11-08', v: 6 }], 7, TODAY) === undefined);
check('a zero starting price gives no change', changeOver([{ d: '2026-10-01', v: 0 }, { d: '2026-11-08', v: 6 }], 7, TODAY) === undefined);

const input = (id: string, name: string): EntryInput => ({
  cardId: id,
  printingId: 'n',
  printingLabel: 'Normal',
  card: { name, localId: '1' },
  price: { amount: 10, currency: 'USD', provider: 'TCGplayer' },
});
let col = emptyCollection('2026-11-01T00:00:00.000Z');
col = addOne(col, input('a-1', 'Up'), '2026-11-01T00:00:00.000Z');
col = setQuantity(col, input('a-1', 'Up'), 2);
col = addOne(col, input('b-1', 'Down'));
col = addOne(col, input('c-1', 'Flat'));
col = addOne(col, input('d-1', 'New'));
let h = emptyHistory();
const series = (key: string, a: number, b: number) => {
  h = addCardPoint(h, key, { d: '2026-10-25', v: a, c: 'USD' });
  h = addCardPoint(h, key, { d: TODAY, v: b, c: 'USD' });
};
series('a-1|n', 10, 15);
series('b-1|n', 20, 15);
series('c-1|n', 10, 10.02);
h = addCardPoint(h, 'd-1|n', { d: TODAY, v: 9, c: 'USD' });

const { gainers, losers } = cardMovers(h, entriesIn(col), 7, TODAY);
check('one gainer, one loser; flat and new are left out', gainers.length === 1 && losers.length === 1, `${gainers.length}/${losers.length}`);
check('gainer is Up with +50%', gainers[0]?.entry.card.name === 'Up' && Math.abs(gainers[0].change.pct - 50) < 1e-9);
check('total change counts the quantity', Math.abs(gainers[0].total - 10) < 1e-9, String(gainers[0]?.total));
check('loser is Down with -25%', losers[0]?.entry.card.name === 'Down' && Math.abs(losers[0].change.pct + 25) < 1e-9);

console.log(`\n${total - failed}/${total} mover fixtures passed.`);
if (failed > 0) process.exit(1);

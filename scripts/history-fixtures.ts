/**
 * Offline fixtures for price history and currency conversion.
 * Run: npx tsx scripts/history-fixtures.ts
 */
import {
  addCardPoint,
  addPortfolioPoint,
  changeOf,
  dayKey,
  emptyHistory,
  inRange,
  parseHistory,
  spanDays,
} from '../src/services/history.model';
import { convert, convertTotals, sortValue } from '../src/services/currency.model';

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

const k = 'base1-4|unl';
let h = emptyHistory();
h = addCardPoint(h, k, { d: '2026-11-05', v: 950, c: 'USD' });
h = addCardPoint(h, k, { d: '2026-11-07', v: 987.13, c: 'USD' });
h = addCardPoint(h, k, { d: '2026-11-06', v: 960, c: 'USD' });
check('points are kept in date order', h.cards[k].map((p) => p.d).join(',') === '2026-11-05,2026-11-06,2026-11-07');
h = addCardPoint(h, k, { d: '2026-11-07', v: 990, c: 'USD' });
check('one point per day: the same day is replaced', h.cards[k].length === 3 && h.cards[k][2].v === 990);
check('zero or missing prices are not recorded', addCardPoint(h, k, { d: '2026-11-08', v: 0, c: 'USD' }) === h);
const switched = addCardPoint(h, k, { d: '2026-11-08', v: 900, c: 'EUR' });
check('a change of currency restarts the series', switched.cards[k].length === 1 && switched.cards[k][0].c === 'EUR');

check('change from first to last point', Math.abs((changeOf(h.cards[k]) ?? 0) - 4.2105) < 0.001, String(changeOf(h.cards[k])));
check('no change with a single point', changeOf([{ v: 5 }]) === undefined);
check('span in days', spanDays(h.cards[k]) === 2);

let long = emptyHistory();
for (let i = 0; i < 800; i++) {
  const d = new Date('2024-01-01T00:00:00');
  d.setDate(d.getDate() + i);
  long = addCardPoint(long, k, { d: dayKey(d), v: 100 + i, c: 'USD' });
}
check('series are capped at 730 days', long.cards[k].length === 730);
const today = long.cards[k][729].d;
check('1M range keeps about 31 points', inRange(long.cards[k], '1M', today).length === 31, String(inRange(long.cards[k], '1M', today).length));
check('12M range keeps about 366 points', inRange(long.cards[k], '12M', today).length === 366, String(inRange(long.cards[k], '12M', today).length));
check('MAX keeps everything', inRange(long.cards[k], 'MAX', today).length === 730);

h = addPortfolioPoint(h, 'main', { d: '2026-11-07', t: { USD: 1974.26, EUR: 3489.25 } });
check('portfolio value points per currency', h.portfolios.main[0].t.EUR === 3489.25);

check('save and load round-trips', JSON.stringify(parseHistory(JSON.stringify(h))) === JSON.stringify(h));
check('corrupt history loads empty', Object.keys(parseHistory('nope').cards).length === 0);
check('broken points are dropped',
  parseHistory(JSON.stringify({ version: 1, cards: { a: [{ d: 'x' }, { d: '2026-11-07', v: 1, c: 'USD' }] }, portfolios: {} })).cards.a.length === 1);

const fx = { eurUsd: 1.1165, date: '2026-11-06' };
check('EUR to USD', Math.abs((convert(100, 'EUR', 'USD', fx) ?? 0) - 111.65) < 1e-9);
check('USD to EUR', Math.abs((convert(111.65, 'USD', 'EUR', fx) ?? 0) - 100) < 1e-9);
check('same currency needs no rate', convert(5, 'USD', 'USD') === 5);
check('no rate means no conversion', convert(5, 'EUR', 'USD') === undefined);
check('unknown currency is not converted', convert(5, 'JPY', 'USD', fx) === undefined);

const c = convertTotals({ USD: 1974.26, EUR: 3489.25 }, 'USD', fx);
// 3489.25 × 1.1165 = 3895.75, + 1974.26 = 5870.01
check('totals collapse into one currency', c.amount === 5870.01 && c.usedRate && Object.keys(c.rest).length === 0, JSON.stringify(c));
const noFx = convertTotals({ USD: 10, EUR: 5 }, 'USD');
check('without a rate, EUR stays separate', noFx.amount === 10 && noFx.rest.EUR === 5 && !noFx.usedRate, JSON.stringify(noFx));
const orig = convertTotals({ USD: 10, EUR: 5 }, 'original', fx);
check('"original" keeps every currency', orig.amount === undefined && orig.rest.USD === 10 && orig.rest.EUR === 5);
check('sort value compares in USD', sortValue(3489.25, 'EUR', fx) > sortValue(1974.26, 'USD', fx) && sortValue(100, 'EUR', fx) > 100);

console.log(`\n${total - failed}/${total} history fixtures passed.`);
if (failed > 0) process.exit(1);

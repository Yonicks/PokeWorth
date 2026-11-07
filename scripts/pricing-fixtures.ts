/**
 * Offline fixtures for printings and their prices (no network). The card
 * records are trimmed copies of real TCGdex responses from 2026-11-07.
 * Run: npx tsx scripts/pricing-fixtures.ts
 */
import { defaultPrinting, formatChange, formatMoney, getPrintings } from '../src/services/printings.service';
import type { Card } from '../src/types/card';

type DetailedCard = Card;

const cmBase1 = {
  updated: '2026-11-07T10:30:45.658Z', unit: 'EUR', avg: 458.1, low: 85, trend: 353.78,
  avg1: 197.8, avg7: 312.04, avg30: 430.3, 'trend-holo': 123.63, 'avg7-holo': 129.55, 'avg30-holo': 202.71,
};
const charizard: DetailedCard = {
  id: 'base1-4', localId: '4', name: 'Charizard',
  variants_detailed: [
    {
      type: 'holo', subtype: 'unlimited', variantId: 'unl',
      pricing: {
        cardmarket: cmBase1,
        tcgplayer: { unit: 'USD', updated: '2026-11-07T10:30:45.539Z', holofoil: { lowPrice: 475, highPrice: 3499.1, marketPrice: 987.13 } },
      },
    },
    {
      type: 'holo', subtype: 'shadowless', stamp: ['1st-edition'], variantId: '1st',
      pricing: { cardmarket: { unit: 'EUR', trend: 3489.25, avg7: 2725.38, avg30: 2456.05 }, tcgplayer: null },
    },
    { type: 'holo', subtype: '1999-2000-copyright', variantId: 'copy' },
  ],
};

const shared = {
  cardmarket: { unit: 'EUR', trend: 0.07, avg7: 0.06, avg30: 0.09, 'trend-holo': 0.46, 'avg7-holo': 0.38, 'avg30-holo': 0.51 },
  tcgplayer: {
    unit: 'USD',
    'reverse-holofoil': { marketPrice: 0.41 },
    normal: { marketPrice: 0.23 },
  },
};
const delphox: DetailedCard = {
  id: 'swsh12-027', localId: '027', name: 'Delphox',
  variants_detailed: [
    { type: 'normal', variantId: 'n', pricing: shared },
    { type: 'reverse', variantId: 'r', pricing: shared },
  ],
};

let failed = 0;
let total = 0;
function check(label: string, ok: boolean, detail: string) {
  total++;
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label}: ${detail}`);
  }
}

const cp = getPrintings(charizard);
check('labels: unlimited left out, subtype and stamp named',
  JSON.stringify(cp.map((p) => p.label)) ===
    JSON.stringify(['Holofoil', 'Holofoil · Shadowless · 1st Edition', 'Holofoil · 1999–2000 Copyright']),
  JSON.stringify(cp.map((p) => p.label)));
check('Charizard holo: TCGplayer market price first (matches $987.13)',
  cp[0].prices[0]?.provider === 'TCGplayer' && cp[0].prices[0].amount === 987.13,
  JSON.stringify(cp[0].prices[0]));
check('Charizard holo: Cardmarket uses base keys, not -holo (AC-P2.7)',
  cp[0].prices[1]?.amount === 353.78, JSON.stringify(cp[0].prices[1]));
check('Charizard holo: change vs 30-day average',
  cp[0].prices[1]?.vs30d !== undefined && Math.abs(cp[0].prices[1].vs30d - -17.78) < 0.01,
  String(cp[0].prices[1]?.vs30d));
check('1st Edition shadowless: Cardmarket only', cp[1].prices.length === 1 && cp[1].prices[0].amount === 3489.25,
  JSON.stringify(cp[1].prices));
check('printing with no pricing is kept, empty', cp[2].prices.length === 0, JSON.stringify(cp[2]));

const dp = getPrintings(delphox);
check('normal printing takes TCGplayer normal + Cardmarket base',
  dp[0].prices[0]?.amount === 0.23 && dp[0].prices[1]?.amount === 0.07, JSON.stringify(dp[0].prices));
check('reverse printing takes TCGplayer reverse-holofoil + Cardmarket -holo',
  dp[1].prices[0]?.amount === 0.41 && dp[1].prices[1]?.amount === 0.46, JSON.stringify(dp[1].prices));

check('default printing is the first priced one',
  defaultPrinting([{ id: 'a', label: 'A', prices: [] }, ...cp])?.id === 'unl', 'wrong default');
check('no variants_detailed -> no printings', getPrintings({ id: 'x', localId: '1', name: 'X' }).length === 0, 'expected []');

check('money format', formatMoney(987.13, 'USD') === '$987.13' && formatMoney(353.78, 'EUR') === '€353.78',
  `${formatMoney(987.13, 'USD')} ${formatMoney(353.78, 'EUR')}`);
check('change format uses a real minus', formatChange(-17.78) === '−17.8%' && formatChange(4) === '+4.0%',
  `${formatChange(-17.78)} ${formatChange(4)}`);

console.log(`\n${total - failed}/${total} pricing fixtures passed.`);
if (failed > 0) process.exit(1);

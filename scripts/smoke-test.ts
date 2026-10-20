/**
 * Node smoke test for the API-facing services (no device needed).
 * Run: npx tsx scripts/smoke-test.ts
 */
import { parseOcrLines, rankCandidates } from '../src/services/card-matcher.service';
import { extractDisplayPrices, getCard, searchCardsByName } from '../src/services/tcgdex.service';

async function main() {
  // 1. Simulated OCR lines from a Base Set Charizard photo.
  const parsed = parseOcrLines([
    'STAGE 2', 'Charizard', 'HP 120', 'Energy Burn', 'Fire Spin',
    'weakness', 'retreat cost', 'Illus. Mitsuhiro Arita', '4/102',
  ]);
  console.log('parsed:', JSON.stringify(parsed, null, 0));
  if (parsed.name !== 'Charizard' || parsed.localId !== '4' || parsed.setTotal !== 102) {
    throw new Error('OCR parsing failed');
  }

  // 2. Catalog search + ranking.
  const briefs = await searchCardsByName(parsed.name);
  console.log('catalog hits:', briefs.length);
  const ranked = rankCandidates(briefs, parsed).slice(0, 3);
  for (const c of ranked) {
    console.log(`  ${c.card.id} #${c.card.localId} score=${c.score.toFixed(2)} [${c.reasons}]`);
  }
  if (ranked[0].score < 0.9) throw new Error('Top candidate not confident');

  // 3. Full card + price extraction.
  const card = await getCard('base1-4');
  const prices = extractDisplayPrices(card);
  console.log('prices:', prices.map((p) => `${p.provider} ${p.label}: ${p.amount} ${p.currency}`));
  if (prices.length === 0) throw new Error('No prices extracted for base1-4');

  console.log('\nSmoke test passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

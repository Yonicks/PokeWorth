/**
 * Live check (network): downloads the real index the way the app does, then times matching a
 * few typical scans on it. Run: npx tsx scripts/card-index-live-check.ts
 */
import { matchCard, parseOcrLines } from '../src/services/card-matcher.service';
import { setCardIndex } from '../src/services/card-index.holder';
import { assembleIndex, buildIndex, type RawCard, type RawSet } from '../src/services/card-index.model';

async function gql<T>(query: string): Promise<T> {
  const res = await fetch('https://api.tcgdex.net/v2/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return ((await res.json()) as { data: T }).data;
}

const scans: { label: string; lines: string[]; expect: string }[] = [
  { label: 'Charizard base', lines: ['Charizard', 'HP 120', 'Fire Spin', '4/102'], expect: 'base1-4' },
  { label: 'Pikachu base', lines: ['Pikachu', 'HP 40', 'Gnaw', '58/102'], expect: 'base1-58' },
  { label: 'Charizard ex 151', lines: ['Charizard ex', 'HP 330', 'Brave Wing', '199/165'], expect: 'sv03.5-199' },
  { label: 'Lugia V', lines: ['Lugia V', 'HP 220', 'Read the Wind', '186/195'], expect: 'swsh12-186' },
  { label: 'Pikachu ex', lines: ['Pikachu ex', 'HP 190', '238/191'], expect: 'sv08-238' },
];

async function main() {
  let t = Date.now();
  const [cards, sets, order] = await Promise.all([
    gql<{ cards: RawCard[] }>(`{ cards { id localId name hp attacks { name } } }`),
    gql<{ sets: RawSet[] }>(`{ sets { id name serie { id } cardCount { official } } }`),
    fetch('https://api.tcgdex.net/v2/en/sets').then(async (r) => ((await r.json()) as { id: string }[]).map((s) => s.id)),
  ]);
  console.log(`download ${((Date.now() - t) / 1000).toFixed(1)} s`);
  t = Date.now();
  const stored = assembleIndex(cards.cards, sets.sets, order, new Date().toISOString());
  const index = buildIndex(stored);
  console.log(`build index (${index.size} cards): ${Date.now() - t} ms`);
  setCardIndex(index);

  for (const s of scans) {
    const start = Date.now();
    const outcome = await matchCard(parseOcrLines(s.lines));
    const ms = Date.now() - start;
    const top = outcome.candidates[0]?.card.id;
    console.log(
      `${top === s.expect ? 'OK  ' : 'MISS'} ${s.label}: top ${top} (want ${s.expect}), confident=${!!outcome.confidentCardId}, ${ms} ms`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

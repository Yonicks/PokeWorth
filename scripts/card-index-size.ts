/**
 * S2 feasibility: how big is an on-device card index?
 *
 * Downloads every English card from TCGdex (GraphQL, one query) with only the fields the
 * matcher uses (name, number, set size, HP, attack names), then reports the raw, compact and
 * gzipped sizes. Network required. Usage: npx tsx scripts/card-index-size.ts [--write]
 * --write saves the compact index to scripts/fixtures/card-index.sample.json (not committed).
 */
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const URL = 'https://api.tcgdex.net/v2/graphql';
const QUERY = `{ cards { id localId name hp attacks { name } set { id cardCount { official total } } } }`;

type Raw = {
  id: string;
  localId: string;
  name: string;
  hp?: number | null;
  attacks?: ({ name: string } | null)[] | null;
  set?: { id: string; cardCount?: { official?: number; total?: number } } | null;
};

async function main() {
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const fetchMs = Date.now() - t0;
  const cards: Raw[] = JSON.parse(text).data.cards;

  // Compact row: [id, localId, name, hp, setOfficialCount, attack names joined by |]
  const rows = cards.map((c) => [
    c.id,
    c.localId,
    c.name,
    c.hp ?? 0,
    c.set?.cardCount?.official ?? 0,
    (c.attacks ?? []).map((a) => a?.name).filter(Boolean).join('|'),
  ]);
  const compact = JSON.stringify(rows);

  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  const names = new Set(cards.map((c) => c.name.toLowerCase()));
  console.log(`cards:            ${cards.length}`);
  console.log(`distinct names:   ${names.size}`);
  console.log(`download:         ${kb(text.length)} in ${(fetchMs / 1000).toFixed(1)} s`);
  console.log(`compact JSON:     ${kb(compact.length)}`);
  console.log(`compact gzipped:  ${kb(gzipSync(compact).length)}`);
  console.log(`with attacks:     ${rows.filter((r) => r[5]).length}`);
  console.log(`with set size:    ${rows.filter((r) => r[4]).length}`);

  if (process.argv.includes('--write')) {
    writeFileSync('scripts/fixtures/card-index.sample.json', compact);
    console.log('wrote scripts/fixtures/card-index.sample.json');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

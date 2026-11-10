/**
 * Offline checks for the on-device card index (src/services/card-index.model.ts) and for the
 * matcher using it. No network: the matcher gets a small index through the holder, and every
 * lookup below is answered by it. Run: npx tsx scripts/card-index-fixtures.ts
 */
import { matchCard, parseOcrLines } from '../src/services/card-matcher.service';
import { getCardIndex, setCardIndex } from '../src/services/card-index.holder';
import {
  assembleIndex,
  buildIndex,
  imageBase,
  isStale,
  parseStoredIndex,
  type IndexRow,
  type IndexSet,
  type StoredIndex,
} from '../src/services/card-index.model';

let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.log(`FAIL  ${label} ${detail}`);
  }
}

const sets: IndexSet[] = [
  ['base1', 'Base Set', 'base', 102],
  ['base2', 'Jungle', 'base', 64],
  ['sv03.5', '151', 'sv', 165],
  ['A1', 'Genetic Apex', 'tcgp', 286],
];
const rows: IndexRow[] = [
  ['base1-4', '4', 'Charizard', 120, 'Fire Spin'],
  ['base1-58', '58', 'Pikachu', 40, 'Gnaw'],
  ['base1-1', '1', 'Alakazam', 80, 'Confuse Ray'],
  ['base2-60', '60', 'Pikachu', 40, 'Agility|Thunder Jolt'],
  ['sv03.5-199', '199', 'Charizard ex', 330, 'Brave Wing|Explosive Vortex'],
  ['A1-94', '94', 'Pikachu', 60, 'Circle Circuit'],
  ['base2-5', '5', 'Pokémon Breeder', 0, ''],
];
const stored: StoredIndex = { v: 1, builtAt: '2026-11-10T00:00:00.000Z', sets, rows };
const index = buildIndex(stored);

// Search
check('search: finds by part of a name', index.search('chariz').map((c) => c.id).join() === 'base1-4,sv03.5-199');
check('search: ignores case and accents', index.search('POKEMON breeder').length === 1);
check('search: an HP keeps only that HP', index.search('Pikachu', 40).map((c) => c.id).join() === 'base1-58,base2-60');
check('search: nothing for a name that is not there', index.search('Zzzz').length === 0);
check('search: an empty name finds nothing', index.search('   ').length === 0);

// Number lookup
check('byNumber: set size picks the set', index.byNumber('4', 102).map((c) => c.id).join() === 'base1-4');
check('byNumber: leading zeros are ignored', index.byNumber('004', 102).length === 1);
check('byNumber: wrong set size finds nothing', index.byNumber('4', 64).length === 0);

// Sets
check('sets: size per set', index.setSizes.get('base1') === 102);
check('sets: order follows the list (older is lower)', (index.setOrder.get('base1') ?? 9) < (index.setOrder.get('sv03.5') ?? 0));
check('sets: TCG Pocket is digital', index.digitalSetIds.has('A1') && !index.digitalSetIds.has('base1'));
check('sets: names are kept', index.setNames.get('base2') === 'Jungle');

// Card records
check('detail: attack names are split', index.detail('base2-60')?.attacks?.map((a) => a.name).join() === 'Agility,Thunder Jolt');
check('detail: a card with no attacks has none', (index.detail('base2-5')?.attacks ?? [1]).length === 0);
check('detail: unknown id is undefined', index.detail('nope-1') === undefined);
check(
  'image: built from series, set and number',
  index.search('Alakazam')[0].image === 'https://assets.tcgdex.net/en/base/base1/1' &&
    imageBase('', 'x', '1') === undefined,
);

// Storage format
check('parse: nothing stored is no index', parseStoredIndex(null) === null && parseStoredIndex('') === null);
check('parse: broken JSON is no index', parseStoredIndex('{nope') === null);
check('parse: a tiny index counts as broken', parseStoredIndex(JSON.stringify(stored)) === null);
const big: StoredIndex = { ...stored, rows: Array.from({ length: 5000 }, (_, i) => [`s-${i}`, String(i), `N${i}`, 0, ''] as IndexRow) };
check('parse: a full index is accepted', parseStoredIndex(JSON.stringify(big))?.rows.length === 5000);
check('parse: another version is refused', parseStoredIndex(JSON.stringify({ ...big, v: 99 })) === null);

// Freshness
const now = Date.parse('2026-11-20T00:00:00.000Z');
check('stale: 10 days old is fresh', !isStale('2026-11-10T00:00:00.000Z', now));
check('stale: 20 days old is stale', isStale('2026-10-31T00:00:00.000Z', now));
check('stale: a bad date is stale', isStale('yesterday', now));

// Assembling the download
const assembled = assembleIndex(
  [
    { id: 'a-1', localId: '1', name: 'A', hp: null, attacks: [null, { name: 'Zap' }] },
    { id: 'b-1', localId: '1', name: 'B', attacks: null },
    { id: 'bad', localId: '1', name: '' },
  ],
  [
    { id: 'b', name: 'Bee', serie: { id: 's' }, cardCount: { official: 3 } },
    { id: 'a', name: 'Ay', serie: null, cardCount: null },
  ],
  ['a', 'b'],
  '2026-11-10T00:00:00.000Z',
);
check('assemble: null attacks are dropped, a missing HP is 0', assembled.rows[0][3] === 0 && assembled.rows[0][4] === 'Zap');
check('assemble: unnamed cards are dropped', assembled.rows.length === 2);
check('assemble: sets follow the release order', assembled.sets.map((s) => s[0]).join() === 'a,b' && assembled.sets[0][2] === '');

// The matcher on the index (the API is never reached: every question below is answered here)
setCardIndex(index);
check('holder: index is in memory', getCardIndex() === index);

async function matching() {
  const charizard = await matchCard(parseOcrLines(['Charizard', 'HP 120', 'Fire Spin', '4/102']));
  check('match: name + number + attack is confident', charizard.confidentCardId === 'base1-4', JSON.stringify(charizard.candidates.map((c) => c.card.id)));

  const pikachu = await matchCard(parseOcrLines(['Pikachu', 'HP 40', 'Gnaw', '58/102']));
  check('match: the printing is picked by number and set size', pikachu.confidentCardId === 'base1-58');
  check('match: Pocket cards never appear', !pikachu.candidates.some((c) => c.card.id === 'A1-94'));

  const noNumber = await matchCard({ name: 'Pikachu', rawLines: ['Pikachu'] });
  check('match: a name alone lists the printings, no auto-accept', noNumber.candidates.length >= 2 && !noNumber.confidentCardId);

  const numberOnly = await matchCard({ localId: '199', setTotal: 165, rawLines: ['199/165'] });
  check('match: a number alone finds the card', numberOnly.candidates[0]?.card.id === 'sv03.5-199');
}

matching()
  .catch((e) => {
    failed++;
    console.log('FAIL  matching threw', e);
  })
  .finally(() => {
    setCardIndex(null);
    console.log(failed === 0 ? '\nAll card index checks passed.' : `\n${failed} card index check(s) failed.`);
    process.exit(failed === 0 ? 0 : 1);
  });

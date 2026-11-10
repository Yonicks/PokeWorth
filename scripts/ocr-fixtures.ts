/**
 * Offline fixtures for OCR text parsing and candidate ranking (no network).
 * Run: npx tsx scripts/ocr-fixtures.ts
 */
import { needsCloudFallback } from '../src/services/ocr-policy';
import {
  isConfidentMatch,
  isCorroborated,
  nameCandidates,
  parseOcrLines,
  rankCandidates,
  splitStrongMatches,
  type RankingContext,
} from '../src/services/card-matcher.service';
import type { Card, CardBrief, ParsedCardText } from '../src/types/card';

interface Expected {
  name?: string | null;
  localId?: string | null;
  setTotal?: number | null;
}

interface Fixture {
  label: string;
  lines: string[];
  /** `null` means the field must be absent. Omitted fields are not checked. */
  expect: Expected;
}

const FIXTURES: Fixture[] = [
  {
    label: 'Base Set Charizard 4/102',
    lines: [
      'STAGE 2', 'Charizard', 'HP 120', 'Energy Burn', 'Fire Spin',
      'weakness', 'retreat cost', 'Illus. Mitsuhiro Arita', '4/102',
    ],
    expect: { name: 'Charizard', localId: '4', setTotal: 102 },
  },
  {
    label: 'promo without slash: SWSH284',
    lines: ['BASIC', 'Pikachu V', 'HP 190', 'SWSH284'],
    expect: { name: 'Pikachu V', localId: 'SWSH284', setTotal: null },
  },
  {
    label: 'VMAX name keeps its suffix',
    lines: ['VMAX', 'Charizard VMAX', 'HP 330', 'Illus. 5ban Graphics', '020/189'],
    expect: { name: 'Charizard VMAX', localId: '020', setTotal: 189 },
  },
  {
    label: 'ex name keeps its suffix',
    lines: ['Basic', 'Pikachu ex', 'HP 190', '057/191'],
    expect: { name: 'Pikachu ex', localId: '057', setTotal: 191 },
  },
  {
    label: 'promo without slash: SM60',
    lines: ['Basic', 'Lucario', '120 HP', 'SM60'],
    expect: { name: 'Lucario', localId: 'SM60', setTotal: null },
  },
  {
    label: 'promo with space: SVP 085',
    lines: ['Basic', 'Mewtwo ex', 'HP 230', 'SVP 085'],
    expect: { name: 'Mewtwo ex', localId: 'SVP085', setTotal: null },
  },
  {
    label: 'trainer gallery TG12/TG30',
    lines: ['Stage 1', 'Raichu', 'HP 120', 'TG12/TG30'],
    expect: { name: 'Raichu', localId: 'TG12', setTotal: 30 },
  },
  {
    label: 'leading zeros 004/102',
    lines: ['STAGE 2', 'Charizard', 'HP 120', '004/102'],
    expect: { name: 'Charizard', localId: '004', setTotal: 102 },
  },
  {
    label: 'stage/HP lines never picked as name',
    lines: ['STAGE 2', 'Stage 1', 'BASIC', 'HP 120', '120 HP', 'Blastoise'],
    expect: { name: 'Blastoise' },
  },
  {
    label: 'only stage/HP lines -> no name',
    lines: ['STAGE 2', 'Stage 1', 'BASIC', 'HP 120', '120 HP'],
    expect: { name: null },
  },
  {
    label: 'Illus. lines never picked as name',
    lines: ['Illus. Mitsuhiro Arita', 'Illus.', 'Venusaur', '15/102'],
    expect: { name: 'Venusaur', localId: '15', setTotal: 102 },
  },
  {
    label: 'damage numbers are not collector numbers',
    lines: ['Charizard', 'HP 120', 'Fire Spin', '120', '100', '30'],
    expect: { name: 'Charizard', localId: null, setTotal: null },
  },
  {
    label: 'lowercase artwork noise skipped for capitalised name (Delphox photo)',
    lines: [
      '0+', 'ed', 'ned', ') 0+', 'gY', 'car i', 'up', 'ch', 'Delphox', '-1600',
      'Ability Faring Magic', 'Energized Storm', '30×', '• CRIm 015/086 +',
    ],
    expect: { name: 'Delphox', localId: '015', setTotal: 86 },
  },
  {
    label: 'all-lowercase OCR still yields a name',
    lines: ['basic', 'pikachu', 'hp 60', '58/102'],
    expect: { name: 'pikachu', localId: '58', setTotal: 102 },
  },
  {
    label: 'slash number wins over a promo-like token',
    lines: ['Pikachu', 'SM 60 promo', '58/102'],
    expect: { name: 'Pikachu', localId: '58', setTotal: 102 },
  },
];

interface RankFixture {
  label: string;
  briefs: CardBrief[];
  lines: string[];
  expectTopId: string;
  expectReason: string;
}

const RANK_FIXTURES: RankFixture[] = [
  {
    label: 'rank: 004/102 matches localId "4" exactly',
    briefs: [
      { id: 'base1-4', localId: '4', name: 'Charizard' },
      { id: 'base4-4', localId: '44', name: 'Charizard' },
    ],
    lines: ['Charizard', '004/102'],
    expectTopId: 'base1-4',
    expectReason: 'number exact',
  },
  {
    label: 'rank: SWSH284 promo matches exactly',
    briefs: [
      { id: 'swshp-SWSH061', localId: 'SWSH061', name: 'Pikachu V' },
      { id: 'swshp-SWSH284', localId: 'SWSH284', name: 'Pikachu V' },
    ],
    lines: ['Pikachu V', 'SWSH284'],
    expectTopId: 'swshp-SWSH284',
    expectReason: 'number exact',
  },
];

function checkField(
  failures: string[],
  field: keyof Expected,
  expected: Expected[keyof Expected],
  actual: ParsedCardText[keyof Expected],
) {
  if (expected === undefined) return;
  if (expected === null) {
    if (actual !== undefined) failures.push(`${field}: expected absent, got ${JSON.stringify(actual)}`);
  } else if (actual !== expected) {
    failures.push(`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let failed = 0;

for (const fixture of FIXTURES) {
  const parsed = parseOcrLines(fixture.lines);
  const failures: string[] = [];
  checkField(failures, 'name', fixture.expect.name, parsed.name);
  checkField(failures, 'localId', fixture.expect.localId, parsed.localId);
  checkField(failures, 'setTotal', fixture.expect.setTotal, parsed.setTotal);
  if (failures.length > 0) {
    failed++;
    console.log(`FAIL  ${fixture.label}: ${failures.join('; ')}`);
  } else {
    console.log(`PASS  ${fixture.label}`);
  }
}

for (const fixture of RANK_FIXTURES) {
  const ranked = rankCandidates(fixture.briefs, parseOcrLines(fixture.lines));
  const top = ranked[0];
  if (top?.card.id === fixture.expectTopId && top.reasons.includes(fixture.expectReason)) {
    console.log(`PASS  ${fixture.label}`);
  } else {
    failed++;
    console.log(
      `FAIL  ${fixture.label}: top=${top?.card.id ?? 'none'} reasons=[${top?.reasons ?? ''}]`,
    );
  }
}

// Ranking with catalog context: set sizes and attack names split reprints.
const reprints: CardBrief[] = [
  { id: 'base1-4', localId: '4', name: 'Charizard' },
  { id: 'base4-4', localId: '4', name: 'Charizard' },
  { id: 'ex14-4', localId: '4', name: 'Charizard' },
];
const setSizes = new Map([['base1', 102], ['base4', 130], ['ex14', 100]]);
const details = new Map<string, Card>([
  ['base1-4', { ...reprints[0], abilities: [{ name: 'Energy Burn' }], attacks: [{ name: 'Fire Spin' }] }],
  ['base4-4', { ...reprints[1], abilities: [{ name: 'Energy Burn' }], attacks: [{ name: 'Fire Spin' }] }],
  ['ex14-4', { ...reprints[2], attacks: [{ name: 'Burning Shield' }, { name: 'Flame Blast' }] }],
]);

const CONTEXT_FIXTURES: {
  label: string;
  lines: string[];
  context: RankingContext;
  expectTop: string;
  expectConfident: boolean;
  expectStrong: number;
}[] = [
  {
    label: 'context: without set sizes, three 4/102 Charizards tie',
    lines: ['Charizard', '4/102'],
    context: {},
    expectTop: 'base4-4',
    expectConfident: false,
    expectStrong: 3,
  },
  {
    label: 'context: set size 102 picks Base Set over reprints',
    lines: ['Charizard', '4/102'],
    context: { setSizes },
    expectTop: 'base1-4',
    expectConfident: true,
    expectStrong: 1,
  },
  {
    label: 'context: attack names split reprints when no number is read',
    lines: ['Charizard', 'Burning Shield', 'Flame Blast'],
    context: { details },
    expectTop: 'ex14-4',
    expectConfident: true,
    expectStrong: 1,
  },
  {
    label: 'context: misread set size does not hide a confident number match',
    lines: ['Pikachu', '58/999'],
    context: { setSizes },
    expectTop: 'base1-58',
    expectConfident: true,
    expectStrong: 1,
  },
];
const pikachus: CardBrief[] = [
  { id: 'base1-58', localId: '58', name: 'Pikachu' },
  { id: 'base2-60', localId: '60', name: 'Pikachu' },
];

for (const fixture of CONTEXT_FIXTURES) {
  const briefs = fixture.lines[0] === 'Pikachu' ? pikachus : reprints;
  const ranked = rankCandidates(briefs, parseOcrLines(fixture.lines), fixture.context);
  const strong = splitStrongMatches(ranked).strong.length;
  const confident = isConfidentMatch(ranked);
  const top = ranked[0]?.card.id;
  // With an exact tie the order is the catalog order, so only check top when it must win.
  const topOk = fixture.expectStrong > 1 || top === fixture.expectTop;
  if (topOk && confident === fixture.expectConfident && strong === fixture.expectStrong) {
    console.log(`PASS  ${fixture.label}`);
  } else {
    failed++;
    console.log(
      `FAIL  ${fixture.label}: top=${top} confident=${confident} strong=${strong} ` +
        `scores=${ranked.map((r) => `${r.card.id}:${r.score.toFixed(2)}`).join(' ')}`,
    );
  }
}

// A name read by OCR never skips confirmation on its own (matchCard combines
// this with isConfidentMatch).
const lone: CardBrief[] = [{ id: 'base1-58', localId: '58', name: 'Pikachu' }];
const PROOF_FIXTURES: { label: string; lines: string[]; expect: boolean }[] = [
  { label: 'proof: a lone name-only match is not backed', lines: ['Pikachu', 'Thunder Shock'], expect: false },
  { label: 'proof: the collector number backs the match', lines: ['Pikachu', '58/102'], expect: true },
  { label: 'proof: a different number does not back it', lines: ['Pikachu', '60/64'], expect: false },
];
for (const fixture of PROOF_FIXTURES) {
  const ranked = rankCandidates(lone, parseOcrLines(fixture.lines));
  // The name alone still scores 100 %, which is why the extra check exists.
  const actual = isCorroborated(ranked[0]);
  if (actual === fixture.expect) {
    console.log(`PASS  ${fixture.label}`);
  } else {
    failed++;
    console.log(`FAIL  ${fixture.label}: backed=${actual} reasons=${ranked[0]?.reasons.join(', ')}`);
  }
}

// Fallback order used by matchCard when the first name guess finds nothing.
const CANDIDATE_FIXTURES: { label: string; lines: string[]; expect: string[] }[] = [
  {
    label: 'candidates: capitalised first, attack name can be retried past',
    lines: ['ned', 'Destructo-Press', 'Copperajah', 'HP 190', '062/167', 'car i'],
    expect: ['Destructo-Press', 'Copperajah', 'ned', 'car i'],
  },
  {
    label: 'candidates: duplicates removed',
    lines: ['Pikachu', 'Pikachu', 'Thunder Shock'],
    expect: ['Pikachu', 'Thunder Shock'],
  },
];

for (const fixture of CANDIDATE_FIXTURES) {
  const actual = nameCandidates(fixture.lines);
  if (JSON.stringify(actual) === JSON.stringify(fixture.expect)) {
    console.log(`PASS  ${fixture.label}`);
  } else {
    failed++;
    console.log(`FAIL  ${fixture.label}: got ${JSON.stringify(actual)}`);
  }
}

// Which reader to trust: the device first, the cloud only when it fails or finds nothing.
const POLICY: { label: string; lines: string[] | null; failed: boolean; cloud: boolean }[] = [
  { label: 'policy: a normal device read is kept (no cloud request)', lines: ['Pikachu', 'HP 60', '58/102'], failed: false, cloud: false },
  { label: 'policy: a device error falls back to the cloud', lines: null, failed: true, cloud: true },
  { label: 'policy: an empty device read falls back to the cloud', lines: [], failed: false, cloud: true },
  { label: 'policy: symbols only count as nothing', lines: ['•', '~~', '1'], failed: false, cloud: true },
  { label: 'policy: one lone short word is suspicious, so the cloud double-checks', lines: ['Ditto'], failed: false, cloud: true },
  { label: 'policy: a short name with its other text is enough', lines: ['Ditto', 'HP 70', '115/128'], failed: false, cloud: false },
];
for (const p of POLICY) {
  if (needsCloudFallback(p.lines, p.failed) === p.cloud) console.log(`PASS  ${p.label}`);
  else {
    failed++;
    console.log(`FAIL  ${p.label}`);
  }
}

const total =
  POLICY.length + FIXTURES.length + RANK_FIXTURES.length + CONTEXT_FIXTURES.length + CANDIDATE_FIXTURES.length;
console.log(`\n${total - failed}/${total} OCR fixtures passed.`);
if (failed > 0) process.exit(1);

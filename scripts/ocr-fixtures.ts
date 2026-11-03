/**
 * Offline fixtures for OCR text parsing and candidate ranking (no network).
 * Run: npx tsx scripts/ocr-fixtures.ts
 */
import { parseOcrLines, rankCandidates } from '../src/services/card-matcher.service';
import type { CardBrief, ParsedCardText } from '../src/types/card';

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

const total = FIXTURES.length + RANK_FIXTURES.length;
console.log(`\n${total - failed}/${total} OCR fixtures passed.`);
if (failed > 0) process.exit(1);

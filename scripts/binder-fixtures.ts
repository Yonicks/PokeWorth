/**
 * Offline fixtures for binder page geometry (no images, no network).
 * Run: npx tsx scripts/binder-fixtures.ts
 */
import {
  DEFAULT_INSET,
  fullFrame,
  guideFrame,
  LAYOUTS,
  pageAspect,
  pocketLabel,
  bottomStripRect,
  pocketRects,
  POCKET_ASPECT,
  previewRectToPhoto,
  type Rect,
} from '../src/services/binder-grid.model';
import { pickPictureSize } from '../src/services/camera-size';
import { normalize } from '../src/utils/text';
import {
  addLines,
  canAdd,
  chooseCard,
  choosePrinting,
  initReview,
  skipPocket,
  tickedCount,
  toggleTick,
} from '../src/services/binder-review.model';
import type { PocketResult } from '../src/services/binder-scan.service';
import { addMany, emptyCollection, quantityOf, type EntryInput } from '../src/services/collection.model';
import type { CardBrief } from '../src/types/card';
import {
  classifyPocket,
  type PocketStatus,
  pocketErrorText,
  runQueue,
  startsTicked,
  summarize,
  textChars,
} from '../src/services/binder-scan.model';
import {
  isPrintingUnsure,
  mergeNumber,
  nameCandidates,
  nameVariants,
  parseHp,
  parseOcrLines,
  rankCandidates,
  resembles,
  sameNameCount,
  searchOrder,
  type MatchOutcome,
} from '../src/services/card-matcher.service';

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

const inside = (r: Rect, w: number, h: number) =>
  r.originX >= 0 && r.originY >= 0 && r.originX + r.width <= w && r.originY + r.height <= h && r.width > 0 && r.height > 0;
const overlap = (a: Rect, b: Rect) =>
  a.originX < b.originX + b.width && b.originX < a.originX + a.width && a.originY < b.originY + b.height && b.originY < a.originY + a.height;
const integers = (r: Rect) => [r.originX, r.originY, r.width, r.height].every(Number.isInteger);

// A 12 MP iPhone photo in portrait: 3024 × 4032.
const W = 3024;
const H = 4032;

const p9 = pocketRects(W, H, '3x3');
check('3×3 gives 9 pockets, row by row', p9.length === 9 && p9[0].index === 0 && p9[8].row === 2 && p9[8].col === 2);
check('every pocket is inside the photo with whole pixels', p9.every((r) => inside(r, W, H) && integers(r)));
check('pockets never overlap', p9.every((a, i) => p9.every((b, j) => i === j || !overlap(a, b))));
check('reading order: left to right, then down',
  p9[1].originX > p9[0].originX && p9[1].originY === p9[0].originY && p9[3].originY > p9[0].originY);
const cellW = W / 3;
check('inset trims 4% of the pocket on each side',
  Math.abs(p9[0].originX - cellW * DEFAULT_INSET) <= 1 && Math.abs(p9[0].width - cellW * (1 - 2 * DEFAULT_INSET)) <= 1,
  JSON.stringify(p9[0]));
const noInset = pocketRects(W, H, '3x3', fullFrame(W, H), 0);
check('with no inset, pockets tile the frame exactly',
  noInset[2].originX + noInset[2].width === W && noInset[8].originY + noInset[8].height === H, JSON.stringify(noInset[8]));
check('a silly inset is capped so pockets keep a size',
  pocketRects(W, H, '3x3', fullFrame(W, H), 0.9).every((r) => r.width > 0 && r.height > 0));

check('2×2 gives 4 pockets', pocketRects(W, H, '2x2').length === 4);
check('3×4 gives 12 pockets', pocketRects(W, H, '3x4').length === 12);
check('page aspect follows the pocket shape', Math.abs(pageAspect('3x3') - POCKET_ASPECT) < 1e-9 && Math.abs(pageAspect('3x4') - (3 * POCKET_ASPECT) / 4) < 1e-9);

const g = guideFrame(W, H, '3x3');
check('guide frame is centred and inside the photo',
  inside(g, W, H) && Math.abs(g.originX * 2 + g.width - W) <= 1 && Math.abs(g.originY * 2 + g.height - H) <= 1, JSON.stringify(g));
check('guide frame has the page shape', Math.abs(g.width / g.height - pageAspect('3x3')) < 0.002, String(g.width / g.height));
check('guide frame keeps a 5% margin', g.originX >= Math.round(W * 0.05) - 1 && g.originY >= Math.round(W * 0.05) - 1, JSON.stringify(g));
const landscape = guideFrame(H, W, '3x3');
check('landscape photo: guide is limited by height', inside(landscape, H, W) && landscape.height <= W && landscape.width < H, JSON.stringify(landscape));

const inGuide = pocketRects(W, H, '3x3', g);
check('pockets inside a guide frame stay inside it',
  inGuide.every((r) => r.originX >= g.originX && r.originY >= g.originY && r.originX + r.width <= g.originX + g.width + 1 && r.originY + r.height <= g.originY + g.height + 1));
check('pockets in the guide keep roughly the pocket shape',
  inGuide.every((r) => Math.abs(r.width / r.height - POCKET_ASPECT) < 0.01), String(inGuide[0].width / inGuide[0].height));

const off = pocketRects(1000, 1000, '2x2', { originX: 600, originY: 600, width: 800, height: 800 });
check('a frame hanging off the photo is clamped inside it', off.every((r) => inside(r, 1000, 1000)), JSON.stringify(off));

check('a 3×3 pocket from a 12 MP photo is big enough to read (≥ 900 px wide)',
  p9[0].width >= 900, String(p9[0].width));
check('labels read row then pocket', pocketLabel(p9[5]) === 'Row 2, pocket 3');
check('layout table matches pocket counts', LAYOUTS['3x3'].cols * LAYOUTS['3x3'].rows === 9 && LAYOUTS['2x2'].label === '4 pockets');

// ── Names that start with a label word ──────────────────────────────────────

check('"Energy Retrieval" is a name, not a label (it was dropped before)',
  nameCandidates(['Item', 'Energy Retrieval', 'Put up to 2 Basic Energy cards from your discard pile'])[0] === 'Energy Retrieval',
  JSON.stringify(nameCandidates(['Item', 'Energy Retrieval'])));
check('names starting with Pokémon, Trainer or Tool stay',
  nameCandidates(['Pokémon Center Lady'])[0] === 'Pokémon Center Lady' && nameCandidates(["Trainer's Mail"])[0] === "Trainer's Mail");
check('real labels are still skipped', nameCandidates(['Stage 2 Evolves from Kadabra', 'Weakness x2', 'Item', 'Energy', 'Pokémon']).length === 0,
  JSON.stringify(nameCandidates(['Stage 2 Evolves from Kadabra', 'Weakness x2', 'Item', 'Energy', 'Pokémon'])));

// ── Printing accuracy: HP, strip number, unsure printings ───────────────────

check('HP is read from the usual OCR shapes',
  [['Hop\'s Snorlax', '- 150 *'], ['Chesnaught', '- 180'], ['Zamazenta', 'Te 130 G'], ['Gengar eX', '$280'], ['Sliggoo', 'RP 90 C'], ['Blaziken', '-D 170 €'], ['Kyogre', 'HP 140']]
    .map(([n, l]) => parseHp([n, l])).join(',') === '150,180,130,280,90,170,140');
check('attack damage lower on the card is not taken for HP',
  parseHp(['Ditto', 'Poke-Power', 'Transform', '50', '30', 'Weakness 2']) === undefined, String(parseHp(['Ditto', 'Poke-Power', 'Transform', '50', '30'])));
check('odd numbers and set numbers are not HP', parseHp(['Pikachu', '58/102', '135', '7']) === undefined);
check('parseOcrLines carries the HP', parseOcrLines(['Alakazam', '- 140', 'Psychic Draw']).hp === 140);

const mergedNo = mergeNumber({ name: 'Ditto', rawLines: ['Ditto', 'x'], hp: 70 }, ['Illus. Tomokazu', '115/128 *']);
check('the strip adds the number and set size, nothing else',
  mergedNo.localId === '115' && mergedNo.setTotal === 128 && mergedNo.name === 'Ditto' && mergedNo.hp === 70 && mergedNo.rawLines.length === 2, JSON.stringify(mergedNo));
check('a strip without a number changes nothing', mergeNumber({ name: 'Ditto', rawLines: [] }, ['Illus. Someone', 'GAME FREAK']).localId === undefined);
const bs = bottomStripRect(800, 1100);
check('the strip is the lower 30% of the pocket, full width', bs.originX === 0 && bs.width === 800 && bs.originY === 770 && bs.originY + bs.height === 1100, JSON.stringify(bs));

const m = (parsedNo: string | undefined, variants: number) => ({ parsed: { localId: parsedNo, rawLines: [] }, variants });
check('no number and several printings: printing unsure', isPrintingUnsure(m(undefined, 5)));
check('a read number or a single printing: not unsure', !isPrintingUnsure(m('115', 5)) && !isPrintingUnsure(m(undefined, 1)));
const b2 = (id: string, name: string): CardBrief => ({ id, localId: '1', name });
check('same-name count looks at the best card only',
  sameNameCount([{ card: b2('a', 'Ditto'), score: 1, reasons: [] }, { card: b2('b', 'Ditto'), score: 1, reasons: [] }, { card: b2('c', 'Dittox'), score: 0.8, reasons: [] }]) === 2);

const tie = [b2('base1-1', 'Alakazam'), b2('mep-1', 'Alakazam'), b2('sv06-1', 'Alakazam')];
const ordered = rankCandidates(tie, { name: 'Alakazam', rawLines: [] }, { setOrder: new Map([['base1', 0], ['sv06', 200], ['mep', 230]]) });
check('tied printings: newest set first', ordered.map((c) => c.card.id).join(',') === 'mep-1,sv06-1,base1-1', ordered.map((c) => c.card.id).join(','));

const mkResult = (index: number, status: PocketStatus, cands: CardBrief[], unsure = false) =>
  ({
    index, row: 0, col: index, uri: `u${index}`, status, lines: [], unsure,
    outcome: { parsed: { rawLines: [] }, candidates: cands.map((card) => ({ card, score: 0.9, reasons: [] })), variants: cands.length },
  }) as unknown as PocketResult;
const rv = initReview([mkResult(0, 'check', [b2('d-1', 'Ditto'), b2('d-2', 'Ditto')], true), mkResult(1, 'sure', [b2('k-1', 'Keldeo')])]);
check('an unsure pocket is never ticked, whatever its status', !rv[0].ticked && rv[0].unsure && rv[1].ticked && !rv[1].unsure);

// ── Phone test fixes: camera size and missing catalog names ─────────────────

check('iOS: the full-resolution "Photo" preset is chosen', pickPictureSize(['Medium', 'High', 'Photo', 'Low']) === 'Photo');
check('Android: the largest WxH wins', pickPictureSize(['640x480', '4000x3000', '1920x1080']) === '4000x3000');
check('unknown size lists leave the default alone', pickPictureSize(['Foo']) === undefined && pickPictureSize([]) === undefined && pickPictureSize(undefined) === undefined);
check('a catalog record without a name no longer crashes the matcher',
  normalize(undefined) === '' && normalize(null) === '' && resembles('Pikachu', [{ name: undefined as unknown as string }]) === false);

// ── Steps 4 and 5: review grid and adding many ──────────────────────────────

const brief = (id: string, name: string): CardBrief => ({ id, localId: '1', name });
const result = (index: number, status: PocketStatus, cands: CardBrief[]) =>
  ({
    index, row: Math.floor(index / 3), col: index % 3, uri: `u${index}`, status, lines: [],
    outcome: { parsed: { rawLines: [] }, candidates: cands.map((card) => ({ card, score: 0.9, reasons: [] })) },
  }) as unknown as PocketResult;

const pieces = [
  result(0, 'sure', [brief('a-1', 'Alpha'), brief('a-2', 'Alpha')]),
  result(1, 'check', [brief('b-1', 'Beta'), brief('b-2', 'Beta')]),
  result(2, 'notfound', []),
  result(3, 'empty', []),
  result(4, 'sure', [brief('a-1', 'Alpha')]),
  undefined,
  result(6, 'error', []),
];
let review = initReview(pieces);
check('every read pocket is on the grid; cancelled ones are not', review.length === 6, String(review.length));
check('only Sure starts ticked (decision 3)', review.filter((p) => p.ticked).map((p) => p.index).join(',') === '0,4');
check('Check is selected but unticked, so one tap adds it', review[1].cardId === 'b-1' && !review[1].ticked);
check('Not found, Empty and Error have nothing to add', [2, 3, 6].every((i) => !canAdd(review.find((p) => p.index === i)!)));
review = toggleTick(review, 2);
check('a pocket with no card cannot be ticked', !review.find((p) => p.index === 2)!.ticked);
review = toggleTick(review, 1);
check('ticking a Check pocket works', review.find((p) => p.index === 1)!.ticked && tickedCount(review) === 3);
review = chooseCard(review, 1, brief('b-2', 'Beta'));
check('choosing another candidate selects it and keeps it ticked', review.find((p) => p.index === 1)!.cardId === 'b-2' && review.find((p) => p.index === 1)!.ticked);
review = chooseCard(review, 2, brief('c-9', 'Searched by hand'));
check('a card found by search can fill a Not found pocket', review.find((p) => p.index === 2)!.cardId === 'c-9' && review.find((p) => p.index === 2)!.ticked);
review = choosePrinting(review, 4, 'holo');
review = skipPocket(review, 0);
check('skip unticks without losing the match', !review.find((p) => p.index === 0)!.ticked && review.find((p) => p.index === 0)!.cardId === 'a-1');
const lines = addLines(review);
check('lines group the same card, printing apart, in page order',
  lines.map((l) => `${l.cardId}${l.printingId ? '/' + l.printingId : ''}x${l.quantity}`).join(' ') === 'b-2x1 c-9x1 a-1/holox1', lines.map((l) => `${l.cardId}x${l.quantity}`).join(' '));
review = chooseCard(toggleTick(review, 0), 0, brief('a-1', 'Alpha'));
review = chooseCard(review, 4, brief('a-1', 'Alpha'));
check('the same card and printing on two pockets adds quantity 2',
  addLines(review).find((l) => l.cardId === 'a-1')?.quantity === 2, JSON.stringify(addLines(review)));

const addInput = (cardId: string, printingId = 'p'): EntryInput => ({
  cardId, printingId, printingLabel: 'Holofoil', card: { name: cardId, localId: '1' },
});
let owned = addMany(emptyCollection('2026-11-08T00:00:00.000Z'), [{ input: addInput('x'), quantity: 2 }, { input: addInput('y'), quantity: 1 }]);
check('addMany adds each card with its quantity', quantityOf(owned, 'x', 'p') === 2 && quantityOf(owned, 'y', 'p') === 1);
owned = addMany(owned, [{ input: addInput('x'), quantity: 1 }, { input: addInput('x'), quantity: 1 }]);
check('cards already owned have their quantity raised, duplicates add up', quantityOf(owned, 'x', 'p') === 4);

// ── Step 3: camera preview → photo mapping ──────────────────────────────────

// iPhone screen 390 × 844 pt showing a 3024 × 4032 photo with "cover":
// scale = max(390/3024, 844/4032) = 0.2093; the photo's sides are cut off on screen.
const screen = { width: 390, height: 844 };
const photo = { width: 3024, height: 4032 };
const whole = previewRectToPhoto({ originX: 0, originY: 0, width: 390, height: 844 }, screen, photo);
check('the whole screen maps to the centre strip of the photo',
  whole.originY === 0 && whole.height === 4032 && whole.originX > 0 && Math.abs(whole.originX * 2 + whole.width - 3024) <= 2,
  JSON.stringify(whole));
const g3 = guideFrame(390, 600, '3x3');
const onScreen = { ...g3, originY: g3.originY + 80 };
const inPhoto = previewRectToPhoto(onScreen, screen, photo);
check('a guide on screen keeps its page shape in the photo',
  Math.abs(inPhoto.width / inPhoto.height - g3.width / g3.height) < 0.01 && inside(inPhoto, 3024, 4032),
  JSON.stringify(inPhoto));
const centre = previewRectToPhoto({ originX: 195, originY: 422, width: 1, height: 1 }, screen, photo);
check('the screen centre is the photo centre', Math.abs(centre.originX - 1512) <= 5 && Math.abs(centre.originY - 2016) <= 5,
  JSON.stringify(centre));
const same = previewRectToPhoto({ originX: 10, originY: 20, width: 100, height: 200 }, { width: 300, height: 400 }, { width: 300, height: 400 });
check('same size and shape: nothing changes', same.originX === 10 && same.originY === 20 && same.width === 100 && same.height === 200);

// ── Step 2: statuses, queue, error text, name variants ──────────────────────

const outcome = (confident: boolean, n = 1) =>
  ({
    parsed: { rawLines: [] },
    candidates: Array.from({ length: n }, (_, i) => ({ card: { id: `c${i}`, localId: '1', name: 'X' }, score: 0.9, reasons: [] })),
    confidentCardId: confident ? 'c0' : undefined,
  }) as unknown as MatchOutcome;

check('almost no text means an empty pocket', classifyPocket(['°', '1'], null) === 'empty' && textChars(['a b', '-c']) === 3);
check('text but no match means not found', classifyPocket(['Some text here'], outcome(false, 0)) === 'notfound');
check('a confident match is Sure and starts ticked', classifyPocket(['Pikachu', '58/102'], outcome(true)) === 'sure' && startsTicked('sure'));
check('an unsure match is Check and starts unticked (decision 3)',
  classifyPocket(['Pikachu'], outcome(false)) === 'check' && !startsTicked('check'));
const sum = summarize(['sure', 'sure', 'check', 'notfound', 'empty', 'error']);
check('page summary counts every status', sum.sure === 2 && sum.found === 3 && sum.empty === 1 && sum.error === 1);
check('rate limit errors read as a limit', /limit/i.test(pocketErrorText(new Error('Cloud OCR HTTP 429'))));
check('network errors read as no connection', pocketErrorText(new TypeError('Network request failed')) === 'No connection.');

async function queueChecks() {
  let running = 0;
  let peak = 0;
  const order: number[] = [];
  const res = await runQueue(
    [30, 5, 20, 1, 10, 2, 8, 3, 4],
    async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i * 10;
    },
    { concurrency: 3, onResult: (_r, i) => order.push(i) },
  );
  check('queue never runs more than 3 at once', peak === 3, String(peak));
  check('queue returns results in pocket order', res.join(',') === '0,10,20,30,40,50,60,70,80', res.join(','));
  check('queue reports each pocket as it finishes', order.length === 9 && order[0] !== 0, order.join(','));

  const ac = new AbortController();
  let started = 0;
  const partial = await runQueue(
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    async (x) => {
      started++;
      if (started === 2) ac.abort();
      await new Promise((r) => setTimeout(r, 5));
      return x;
    },
    { concurrency: 1, signal: ac.signal },
  );
  check('cancel stops new pockets and adds nothing for them',
    started === 2 && partial.filter((x) => x !== undefined).length === 2, `${started} ${JSON.stringify(partial)}`);
}

check('ex variants: "ev", "e" and glued "ex" become " ex"',
  nameVariants('Mega Mawile ev').includes('Mega Mawile ex') &&
    nameVariants('Gouging Fire e').includes('Gouging Fire ex') &&
    nameVariants('Pikachuex').includes('Pikachu ex'),
  JSON.stringify([nameVariants('Mega Mawile ev'), nameVariants('Pikachuex')]));
check('noise in front of the name is dropped', nameVariants('STAGEZ Blaziken').includes('Blaziken') && nameVariants('N. Reshiram').includes('Reshiram'));
check('trainer prefix misread: noisy first word is dropped', nameVariants('My Gyarados').includes('Gyarados'));
check('a generic last word is never searched on its own ("Draw & card")', !nameVariants('Draw & card').includes('card'),
  JSON.stringify(nameVariants('Draw & card')));
check('a stage label glued to the name is stripped, not the whole line',
  nameCandidates(['STAGEZ Blaziken', 'Heat Blast'])[0] === 'Blaziken' && nameCandidates(['BASIS', 'Pikachu ex®'])[0] === 'Pikachu ex®',
  JSON.stringify(nameCandidates(['STAGEZ Blaziken', 'Heat Blast'])));
check('an attack name does not count as finding "Pokémon Collector"',
  !resembles('Collect', [{ name: 'Pokémon Collector' }]) && resembles('Butte', [{ name: 'Butterfree' }]) && resembles('Gengar eX', [{ name: 'Gengar ex' }]));
check('a dropped apostrophe is put back ("Mistys Lapras")', nameVariants('Mistys Lapras').includes("Misty's Lapras"),
  JSON.stringify(nameVariants('Mistys Lapras')));
check('trailing symbols are stripped before the ex cleanup', nameVariants('Pikachu ex®').includes('Pikachu ex'),
  JSON.stringify(nameVariants('Pikachu ex®')));
check('cut-off name: short prefix is tried', nameVariants('Butteri').includes('Butte'));
check('the original spelling is always tried first', nameVariants("Misty's Lapras")[0] === "Misty's Lapras");
check('search order: first guess variants, then other lines, capped at 8',
  (() => {
    const o = searchOrder('My Gyarados', ['My Gyarados', 'Splashing Panic', 'Waterfall']);
    return o[0] === 'My Gyarados' && o.includes('Gyarados') && o.indexOf('Gyarados') < o.indexOf('Splashing Panic') && o.length <= 8;
  })(),
  JSON.stringify(searchOrder('My Gyarados', ['My Gyarados', 'Splashing Panic', 'Waterfall'])));

queueChecks().then(() => {
  console.log(`\n${total - failed}/${total} binder fixtures passed.`);
  if (failed > 0) process.exit(1);
});

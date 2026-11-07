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
  pocketRects,
  POCKET_ASPECT,
  type Rect,
} from '../src/services/binder-grid.model';
import {
  classifyPocket,
  pocketErrorText,
  runQueue,
  startsTicked,
  summarize,
  textChars,
} from '../src/services/binder-scan.model';
import {
  nameCandidates,
  nameVariants,
  resembles,
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

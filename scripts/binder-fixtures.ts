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

console.log(`\n${total - failed}/${total} binder fixtures passed.`);
if (failed > 0) process.exit(1);

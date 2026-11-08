/**
 * Offline fixtures for page-edge detection on synthetic binder pages (no photos
 * in the repo). The real-photo numbers behind the thresholds are in docs/status.md.
 * Run: npx tsx scripts/page-edges-fixtures.ts
 */
import {
  darkThreshold,
  detectPageFrame,
  isPlausibleFrame,
  scaleRect,
} from '../src/services/page-edges.model';

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

interface Spec {
  w: number;
  h: number;
  /** Page origin and pocket pitch in the image. */
  px: number;
  py: number;
  pitchX: number;
  pitchY: number;
  cols: number;
  rows: number;
}

/** Cloth background, dark sleeve pockets with a bright card, near-black seams between pockets. */
function page(s: Spec, seamWidth = 9): Uint8Array {
  const g = new Uint8Array(s.w * s.h).fill(150);
  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < s.w && y < s.h) g[y * s.w + x] = v;
  };
  for (let y = s.py; y < s.py + s.rows * s.pitchY; y++) for (let x = s.px; x < s.px + s.cols * s.pitchX; x++) set(x, y, 115);
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const cx = s.px + c * s.pitchX + Math.round(s.pitchX * 0.12);
      const cy = s.py + r * s.pitchY + Math.round(s.pitchY * 0.1);
      for (let y = cy; y < cy + s.pitchY * 0.78; y++) for (let x = cx; x < cx + s.pitchX * 0.76; x++) set(Math.round(x), Math.round(y), 190);
    }
  }
  for (let c = 1; c < s.cols; c++) for (let y = s.py; y < s.py + s.rows * s.pitchY; y++) for (let k = 0; k < seamWidth; k++) set(s.px + c * s.pitchX - Math.floor(seamWidth / 2) + k, y, 15);
  for (let r = 1; r < s.rows; r++) for (let x = s.px; x < s.px + s.cols * s.pitchX; x++) for (let k = 0; k < seamWidth; k++) set(x, s.py + r * s.pitchY - Math.floor(seamWidth / 2) + k, 15);
  return g;
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const base: Spec = { w: 240, h: 320, px: 14, py: 12, pitchX: 74, pitchY: 98, cols: 3, rows: 3 };

const a = detectPageFrame(page(base), base.w, base.h, '3x3');
// Accuracy is about 5 % of the page (pitch is found in whole pixels on a 240 px image);
// the inset around every pocket absorbs that.
check('a clean 3×3 page: frame within 5 % of the page', !!a && near(a.frame.originX, 14, 12) && near(a.frame.originY, 12, 14) && near(a.frame.width, 222, 14) && near(a.frame.height, 294, 14),
  JSON.stringify(a?.frame));
check('a clean page is trusted', isPlausibleFrame(a, base.w, base.h), `conf ${a?.confidence.toFixed(2)} contrast ${a?.contrast.toFixed(2)}`);
check('seam positions are reported', !!a && a.seamsX.length === 2 && near(a.seamsX[0], 14 + 74, 4) && a.seamsY.length === 2);

const shifted = { ...base, px: 40, py: 40 };
const b = detectPageFrame(page(shifted), base.w, base.h, '3x3');
check('a page shifted down-right is found where it is', !!b && near(b.frame.originX, 40, 8) && near(b.frame.originY, 40, 8), JSON.stringify(b?.frame));

const cut = { ...base, px: -45, w: 240 };
const c = detectPageFrame(page(cut), cut.w, cut.h, '3x3');
check('a page cut off at the left edge keeps its true left edge (outside the photo)', !!c && c.frame.originX < -20 && near(c.frame.originX, -45, 10), JSON.stringify(c?.frame));

const tall: Spec = { ...base, rows: 4, h: 400, pitchY: 92 };
const d = detectPageFrame(page(tall), tall.w, tall.h, '3x4');
check('a 3×4 page finds three row seams', !!d && d.seamsY.length === 3 && near(d.frame.height, 4 * 92, 12), JSON.stringify(d?.frame));

check('2×2 pages are not handled (one seam cannot give the pitch): fall back', detectPageFrame(page({ ...base, cols: 2, rows: 2 }), 240, 320, '2x2') === null);
check('a tiny image is refused', detectPageFrame(new Uint8Array(30 * 30), 30, 30, '3x3') === null);

const flat = detectPageFrame(new Uint8Array(240 * 320).fill(120), 240, 320, '3x3');
check('a flat grey photo is not trusted', !isPlausibleFrame(flat, 240, 320));
const noise = new Uint8Array(240 * 320);
let seed = 7;
for (let i = 0; i < noise.length; i++) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  noise[i] = seed % 256;
}
check('noise is not trusted', !isPlausibleFrame(detectPageFrame(noise, 240, 320, '3x3'), 240, 320));

check('dark threshold: darkest 10 % of a half-and-half image is the dark half', darkThreshold([...new Array(50).fill(20), ...new Array(50).fill(200)]) === 20);
const sc = scaleRect({ originX: 10, originY: 20, width: 100, height: 200 }, 12.6);
check('rectangles scale up to the full photo', sc.originX === 126 && sc.originY === 252 && sc.width === 1260 && sc.height === 2520, JSON.stringify(sc));

console.log(`\n${total - failed}/${total} page-edge fixtures passed.`);
if (failed > 0) process.exit(1);

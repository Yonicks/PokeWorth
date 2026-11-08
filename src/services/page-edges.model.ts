/**
 * Find where the binder page is in a photo (pure, tested offline).
 *
 * The darkest things in a photo of a binder page are the seams between the
 * sleeves: in a 3×3 page two vertical and two horizontal black lines. Their
 * spacing is the pocket pitch, so the page frame follows from the seams
 * (first seam minus one pitch, up to the last seam plus one pitch) however the
 * photo is framed, even when part of the page is cut off at an edge.
 *
 * Works for layouts with at least 3 columns (3×3, 3×4): a 2-column page has a
 * single seam, which does not reveal the pitch, so callers fall back to the
 * camera guide for those.
 *
 * Input is a small grey image (about 240 px wide is plenty); output is in the
 * same pixel units, so callers scale it up to the full photo.
 *
 * Known limits: the page must be upright (portrait, not rotated); seams must be
 * clearly the darkest lines (the darkest 10 % of pixels count as dark), so
 * pages with very thin or pale seams can be misjudged; accuracy is about 5 % of
 * the page. Safeguards: a confidence check, and callers fall back to the camera
 * guide whenever detection fails.
 */

import { LAYOUTS, type BinderLayout, type Rect } from './binder-grid.model';

export interface PageFrameResult {
  /** Page rectangle in the analysed image's pixels (may extend past the image). */
  frame: Rect;
  /** How clearly the seams stand out, ≥ 1; below MIN_CONFIDENCE the result is not trusted. */
  confidence: number;
  /** Seams against the typical line of the page (median), a second, sharper measure. */
  contrast: number;
  /** Seam positions found: x for the columns and y for the rows, in image pixels. */
  seamsX: number[];
  seamsY: number[];
}

/**
 * Thresholds tuned on the owner's five page photos and two single-card images
 * (confidence / contrast): real pages 2.33–4.51 / 2.90–7.07, a single card
 * 1.98–2.19 / 2.17–2.34, noise about 1.1. Both must pass. Only a handful of
 * photos back these numbers, so a failed detection falls back to the camera
 * guide instead of guessing.
 */
export const MIN_CONFIDENCE = 2.25;
export const MIN_CONTRAST = 2.6;

/** Smallest image worth analysing. */
const MIN_SIDE = 60;

/** Moving average with a radius of `r` samples. */
function smooth(a: ArrayLike<number>, r: number): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = -r; k <= r; k++) {
      const v = a[i + k];
      if (v !== undefined) {
        s += v;
        n++;
      }
    }
    out[i] = s / n;
  }
  return out;
}

/** The brightness below which the darkest `share` of pixels fall. */
export function darkThreshold(gray: ArrayLike<number>, share = 0.1): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  const target = gray.length * share;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += hist[v];
    if (seen >= target) return v;
  }
  return 255;
}

interface Series {
  /** Position of the first seam. */
  start: number;
  /** Spacing between seams (the pocket pitch). */
  pitch: number;
  /** Seam darkness relative to the profile's average. */
  strength: number;
  /** Seam darkness relative to the profile's median (what a typical, non-seam line looks like). */
  contrast: number;
}

/**
 * Best run of `count` equally spaced peaks in a profile: the first seam at
 * `start`, then every `pitch`. `prefer` softly favours one pitch.
 */
function findSeries(
  profile: ArrayLike<number>,
  count: number,
  pitchMin: number,
  pitchMax: number,
  prefer?: number,
): Series | null {
  const n = profile.length;
  const sm = smooth(profile, Math.max(1, Math.round(n * 0.008)));
  const mean = sm.reduce((a, b) => a + b, 0) / n;
  if (mean <= 0) return null;
  const median = [...sm].sort((a, b) => a - b)[Math.floor(n / 2)];
  let best: (Series & { score: number }) | null = null;
  for (let p = Math.max(4, Math.round(pitchMin)); p <= Math.round(pitchMax); p++) {
    // Seams are interior lines: keep clear of the photo's very edges, where the
    // black binder border and the photo's own dark corners would pose as seams.
    for (let a = Math.round(n * 0.1); a + (count - 1) * p <= n * 0.92; a++) {
      let sum = 0;
      for (let i = 0; i < count; i++) sum += sm[a + i * p];
      // Score on the summed seam darkness (a mean would let the pitch preference outweigh the evidence).
      const score = sum - (prefer ? (0.5 * Math.abs(p - prefer)) / prefer : 0);
      if (!best || score > best.score) {
        best = { start: a, pitch: p, strength: sum / count / mean, contrast: sum / count / Math.max(median, 1e-3), score };
      }
    }
  }
  return best;
}

export function detectPageFrame(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  layout: BinderLayout,
): PageFrameResult | null {
  const { cols, rows } = LAYOUTS[layout];
  if (cols < 3 || rows < 2 || width < MIN_SIDE || height < MIN_SIDE || gray.length < width * height) return null;

  const t = darkThreshold(gray);
  const colDark = new Array<number>(width).fill(0);
  const rowDark = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] <= t) {
        colDark[x]++;
        rowDark[y]++;
      }
    }
  }
  const colProfile = colDark.map((v) => v / height);
  const rowProfile = rowDark.map((v) => v / width);

  // A page spans between 60 % and 130 % of the photo's width.
  const xs = findSeries(colProfile, cols - 1, (0.6 * width) / cols, (1.3 * width) / cols);
  if (!xs) return null;
  // Pockets are taller than wide: pitch 1.05–1.55× the column pitch, usually ~1.25×.
  const ys = findSeries(rowProfile, rows - 1, xs.pitch * 1.05, xs.pitch * 1.55, xs.pitch * 1.25);
  if (!ys) return null;

  return {
    frame: {
      originX: xs.start - xs.pitch,
      originY: ys.start - ys.pitch,
      width: cols * xs.pitch,
      height: rows * ys.pitch,
    },
    confidence: Math.min(xs.strength, ys.strength),
    contrast: Math.min(xs.contrast, ys.contrast),
    seamsX: Array.from({ length: cols - 1 }, (_, i) => xs.start + i * xs.pitch),
    seamsY: Array.from({ length: rows - 1 }, (_, i) => ys.start + i * ys.pitch),
  };
}

/** Scale a rectangle from the analysed image to the full photo. */
export function scaleRect(r: Rect, factor: number): Rect {
  return {
    originX: Math.round(r.originX * factor),
    originY: Math.round(r.originY * factor),
    width: Math.round(r.width * factor),
    height: Math.round(r.height * factor),
  };
}

/** Whether a detection can be trusted: clear seams and a frame that is roughly the photo's size. */
export function isPlausibleFrame(result: PageFrameResult | null, width: number, height: number): boolean {
  if (!result || result.confidence < MIN_CONFIDENCE || result.contrast < MIN_CONTRAST) return false;
  const { frame } = result;
  const area = (Math.min(width, frame.originX + frame.width) - Math.max(0, frame.originX)) *
    (Math.min(height, frame.originY + frame.height) - Math.max(0, frame.originY));
  // At least a quarter of the photo must be page, and the frame must not be far larger than the photo.
  return area >= width * height * 0.25 && frame.width <= width * 1.5 && frame.height <= height * 1.5;
}

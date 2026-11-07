/**
 * Binder page geometry (binder scan, step 1). Pure: no images, no React, so
 * the maths is tested offline (scripts/binder-fixtures.ts).
 *
 * A photo contains the page somewhere inside it (the "frame"). The frame is
 * split into equal pockets, and each pocket is shrunk by an inset so pocket
 * seams and sleeve edges stay out of the crop. The camera guide (step 3) is
 * drawn from the same `guideFrame`, so what you line up is what gets cut.
 */

export type BinderLayout = '3x3' | '2x2' | '3x4';

export interface LayoutInfo {
  cols: number;
  rows: number;
  /** Short label for the picker, e.g. "9 pockets". */
  label: string;
}

export const LAYOUTS: Record<BinderLayout, LayoutInfo> = {
  '3x3': { cols: 3, rows: 3, label: '9 pockets' },
  '2x2': { cols: 2, rows: 2, label: '4 pockets' },
  '3x4': { cols: 3, rows: 4, label: '12 pockets' },
};

/** Layouts offered in the app (decision 1: 3×4 later). */
export const ENABLED_LAYOUTS: BinderLayout[] = ['3x3', '2x2'];

/**
 * A pocket is a little larger than a card in a sleeve: about 66 × 92 mm
 * (a card is 63 × 88). Step 0 checks this against real pages.
 */
export const POCKET_ASPECT = 66 / 92;

/** Default share of each pocket side trimmed away (4% per edge). */
export const DEFAULT_INSET = 0.04;

/** A rectangle in image pixels, named like ImageManipulator's crop(). */
export interface Rect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface PocketRect extends Rect {
  /** 0-based, row by row from the top left. */
  index: number;
  row: number;
  col: number;
}

/** Width ÷ height of a whole page for a layout. */
export function pageAspect(layout: BinderLayout): number {
  const { cols, rows } = LAYOUTS[layout];
  return (cols * POCKET_ASPECT) / rows;
}

/**
 * The largest page-shaped rectangle centred in an image, leaving `margin`
 * (share of the shorter side) free on every edge. Used for the camera guide
 * and as the default crop frame for a camera photo.
 */
export function guideFrame(
  imageWidth: number,
  imageHeight: number,
  layout: BinderLayout,
  margin = 0.05,
): Rect {
  const pad = Math.min(imageWidth, imageHeight) * margin;
  const availW = Math.max(1, imageWidth - pad * 2);
  const availH = Math.max(1, imageHeight - pad * 2);
  const aspect = pageAspect(layout);
  let width = availW;
  let height = width / aspect;
  if (height > availH) {
    height = availH;
    width = height * aspect;
  }
  return {
    originX: Math.round((imageWidth - width) / 2),
    originY: Math.round((imageHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** The whole image as a frame (imported photos the user already cropped). */
export function fullFrame(imageWidth: number, imageHeight: number): Rect {
  return { originX: 0, originY: 0, width: Math.round(imageWidth), height: Math.round(imageHeight) };
}

function clampRect(r: Rect, imageWidth: number, imageHeight: number): Rect {
  const x = Math.max(0, Math.min(Math.floor(imageWidth) - 1, Math.round(r.originX)));
  const y = Math.max(0, Math.min(Math.floor(imageHeight) - 1, Math.round(r.originY)));
  return {
    originX: x,
    originY: y,
    width: Math.max(1, Math.min(Math.floor(imageWidth) - x, Math.round(r.width))),
    height: Math.max(1, Math.min(Math.floor(imageHeight) - y, Math.round(r.height))),
  };
}

/**
 * One rectangle per pocket, row by row, inside `frame`, each trimmed by
 * `inset` on every side and kept inside the image.
 */
export function pocketRects(
  imageWidth: number,
  imageHeight: number,
  layout: BinderLayout,
  frame: Rect = fullFrame(imageWidth, imageHeight),
  inset = DEFAULT_INSET,
): PocketRect[] {
  const { cols, rows } = LAYOUTS[layout];
  const cellW = frame.width / cols;
  const cellH = frame.height / rows;
  const trim = Math.min(Math.max(inset, 0), 0.45);
  const out: PocketRect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const rect = clampRect(
        {
          originX: frame.originX + col * cellW + cellW * trim,
          originY: frame.originY + row * cellH + cellH * trim,
          width: cellW * (1 - trim * 2),
          height: cellH * (1 - trim * 2),
        },
        imageWidth,
        imageHeight,
      );
      out.push({ ...rect, index: row * cols + col, row, col });
    }
  }
  return out;
}

/** "Row 2, pocket 3" for screen readers and error messages. */
export function pocketLabel(p: Pick<PocketRect, 'row' | 'col'>): string {
  return `Row ${p.row + 1}, pocket ${p.col + 1}`;
}

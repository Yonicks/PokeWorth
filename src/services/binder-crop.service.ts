/**
 * Cut a binder page photo into one image per pocket (binder scan, step 1).
 * Geometry comes from binder-grid.model.ts; cropping uses
 * expo-image-manipulator, which is included in Expo Go (SDK 58 docs).
 *
 * Pocket images are saved at full resolution: on-device OCR reads them as
 * they are, and the cloud OCR path already shrinks each one under its 1 MB
 * limit before sending.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { detectPageFrameInPhoto } from './page-edges.service';
import {
  bottomStripRect,
  DEFAULT_INSET,
  fullFrame,
  guideFrame,
  pocketRects,
  type BinderLayout,
  type PocketRect,
  type Rect,
} from './binder-grid.model';

export interface PocketImage extends PocketRect {
  /** Local file (native) or data/blob URL (web) of the cropped pocket. */
  uri: string;
}

export interface CropOptions {
  /**
   * Where the page is in the photo: an exact rectangle (mapped from the
   * on-screen camera guide), "guide" for a centred page-shaped frame, or
   * "full" when the whole photo is the page (imported photos).
   */
  frame?: 'guide' | 'full' | Rect;
  inset?: number;
}

/**
 * Flag: the page frame is auto-detected unless EXPO_PUBLIC_BINDER_AUTO_FRAME=off
 * (restart Expo with --clear after changing it).
 */
export const AUTO_FRAME = process.env.EXPO_PUBLIC_BINDER_AUTO_FRAME !== 'off';

export type FrameSource = 'auto-detected' | 'camera guide' | 'whole photo';

/**
 * Where the page is: the auto-detected frame when it can be found with
 * confidence (3-column layouts), otherwise the fallback the capture screen
 * gave (the mapped camera guide, or the whole photo for imports).
 */
export async function resolvePageFrame(
  uri: string,
  layout: BinderLayout,
  fallback: Rect | 'full',
  autoDetect = AUTO_FRAME,
): Promise<{ frame: Rect | 'full'; source: FrameSource }> {
  const fallbackResult = { frame: fallback, source: fallback === 'full' ? 'whole photo' : 'camera guide' } as const;
  if (!autoDetect) return fallbackResult;
  const found = await detectPageFrameInPhoto(uri, layout);
  return found ? { frame: found.frame, source: 'auto-detected' } : fallbackResult;
}

/** Pixel size of an image. */
export async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(uri).renderAsync();
  return { width: ref.width, height: ref.height };
}

/** Crop the bottom strip (collector number area) out of one pocket image. */
export async function cropBottomStrip(uri: string): Promise<string> {
  const { width, height } = await imageSize(uri);
  const r = bottomStripRect(width, height);
  const context = ImageManipulator.manipulate(uri);
  context.crop({ originX: r.originX, originY: r.originY, width: r.width, height: r.height });
  const image = await context.renderAsync();
  return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 })).uri;
}

/**
 * Crop every pocket of `layout` out of the photo at `uri`, row by row.
 * Each crop uses its own manipulator context, since the docs do not say
 * whether several crops on one context stack.
 */
export async function cropPockets(
  uri: string,
  layout: BinderLayout,
  { frame = 'guide', inset = DEFAULT_INSET }: CropOptions = {},
): Promise<PocketImage[]> {
  const { width, height } = await imageSize(uri);
  const pageFrame =
    frame === 'guide'
      ? guideFrame(width, height, layout)
      : frame === 'full'
        ? fullFrame(width, height)
        : frame;
  const rects = pocketRects(width, height, layout, pageFrame, inset);

  const out: PocketImage[] = [];
  for (const rect of rects) {
    const context = ImageManipulator.manipulate(uri);
    context.crop({ originX: rect.originX, originY: rect.originY, width: rect.width, height: rect.height });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    out.push({ ...rect, uri: saved.uri });
  }
  return out;
}

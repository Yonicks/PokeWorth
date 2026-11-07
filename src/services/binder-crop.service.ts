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

import {
  DEFAULT_INSET,
  fullFrame,
  guideFrame,
  pocketRects,
  type BinderLayout,
  type PocketRect,
} from './binder-grid.model';

export interface PocketImage extends PocketRect {
  /** Local file (native) or data/blob URL (web) of the cropped pocket. */
  uri: string;
}

export interface CropOptions {
  /**
   * "guide": the page sits inside the camera guide (photos from the binder
   * camera). "full": the whole photo is the page (imported photos).
   */
  frame?: 'guide' | 'full';
  inset?: number;
}

/** Pixel size of an image. */
export async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(uri).renderAsync();
  return { width: ref.width, height: ref.height };
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
  const pageFrame = frame === 'guide' ? guideFrame(width, height, layout) : fullFrame(width, height);
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

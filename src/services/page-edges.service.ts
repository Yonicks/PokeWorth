/**
 * Find the binder page in a real photo (binder scan, page-edge detection).
 *
 * Expo Go has no pixel access, so the photo is shrunk to about 240 px wide
 * with expo-image-manipulator, saved as a JPEG, and decoded in plain
 * JavaScript (jpeg-js). The detection itself is page-edges.model.ts.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import type { BinderLayout, Rect } from './binder-grid.model';
import { detectPageFrame, isPlausibleFrame, scaleRect } from './page-edges.model';

/** Width of the analysed copy; the page seams are still clear at this size. */
const ANALYSIS_WIDTH = 240;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Base64 (bare or as a data URL) to bytes; does not rely on atob being present. */
export function base64ToBytes(input: string): Uint8Array {
  const text = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const v = B64_INDEX[text.charCodeAt(i)] ?? -1;
    if (v < 0) continue; // padding, newlines
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export interface PhotoPageFrame {
  /** Page rectangle in the full photo's pixels (may extend past the photo's edges). */
  frame: Rect;
  confidence: number;
  contrast: number;
}

/**
 * The page's frame in the full-size photo, or null when it cannot be found
 * with confidence (not a 3-column layout, unclear seams, decode failure).
 */
export async function detectPageFrameInPhoto(uri: string, layout: BinderLayout): Promise<PhotoPageFrame | null> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    if (!original.width || !original.height) return null;
    const height = Math.max(1, Math.round((original.height * ANALYSIS_WIDTH) / original.width));
    // Height is given explicitly: `height: null` fails on web for some images.
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: ANALYSIS_WIDTH, height });
    const small = await (await context.renderAsync()).saveAsync({
      base64: true,
      compress: 0.85,
      format: SaveFormat.JPEG,
    });
    if (!small.base64) return null;

    const rgba = decode(base64ToBytes(small.base64), { useTArray: true, formatAsRGBA: true });
    const gray = new Uint8Array(rgba.width * rgba.height);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(0.299 * rgba.data[i * 4] + 0.587 * rgba.data[i * 4 + 1] + 0.114 * rgba.data[i * 4 + 2]);
    }

    const found = detectPageFrame(gray, rgba.width, rgba.height, layout);
    if (!isPlausibleFrame(found, rgba.width, rgba.height) || !found) return null;
    return {
      frame: scaleRect(found.frame, original.width / rgba.width),
      confidence: found.confidence,
      contrast: found.contrast,
    };
  } catch (e) {
    if (__DEV__) console.warn('Page-edge detection failed', e);
    return null;
  }
}

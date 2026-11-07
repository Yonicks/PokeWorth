/**
 * Cloud OCR fallback (OCR.space) for binaries without on-device OCR:
 * Expo Go (including iPhone without a paid Apple account) and web.
 *
 * The photo is shrunk to a JPEG well under the free plan's 1 MB limit and
 * sent to OCR.space, so it leaves the device. Release builds use on-device
 * OCR and never reach this path. Set EXPO_PUBLIC_CLOUD_OCR=off to disable it.
 *
 * Key: EXPO_PUBLIC_OCR_SPACE_KEY (free at ocr.space). Without one the public
 * demo key "helloworld" is used, which is shared and rate-limited.
 * EXPO_PUBLIC_ values are bundled into the app, so this key is for testing;
 * a shipped cloud path would go through a server route instead.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const ENDPOINT = 'https://api.ocr.space/parse/image';
const DEMO_KEY = 'helloworld';
const TIMEOUT_MS = 20_000;
// Wide enough for the small collector number, small enough to stay under 1 MB.
const MAX_WIDTH = 1200;

type OcrSpaceResponse = {
  ParsedResults?: { ParsedText?: string }[];
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
};

export function isCloudOcrEnabled(): boolean {
  return process.env.EXPO_PUBLIC_CLOUD_OCR !== 'off';
}

async function toJpegDataUrl(uri: string): Promise<string> {
  // Measure first: only shrink images wider than MAX_WIDTH (a binder pocket is
  // often narrower, and enlarging it adds bytes, not detail), and pass the
  // height explicitly, since `height: null` fails on web for freshly cropped
  // images ("source height is zero or not a number").
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const context = ImageManipulator.manipulate(uri);
  if (original.width > MAX_WIDTH) {
    context.resize({ width: MAX_WIDTH, height: Math.round((original.height * MAX_WIDTH) / original.width) });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error('Could not encode photo');
  // Web may already return a data URL; native returns bare base64.
  return result.base64.startsWith('data:')
    ? result.base64
    : `data:image/jpeg;base64,${result.base64}`;
}

/** Splits OCR.space's text block into trimmed, non-empty lines. */
export function splitParsedText(response: OcrSpaceResponse): string[] {
  if (response.IsErroredOnProcessing) {
    const msg = Array.isArray(response.ErrorMessage)
      ? response.ErrorMessage.join('; ')
      : response.ErrorMessage;
    throw new Error(`Cloud OCR failed: ${msg ?? 'unknown error'}`);
  }
  return (response.ParsedResults ?? [])
    .flatMap((r) => (r.ParsedText ?? '').split(/\r?\n/))
    .map((l) => l.trim())
    // The public demo key prepends "[Note: the 'helloworld' demo key ...]".
    .filter((l) => l.length > 0 && !/^\[note:/i.test(l));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs cloud OCR on a photo and returns its text lines. Throws on failure.
 * A temporary server error (5xx, seen when several pockets are sent at once)
 * is retried twice after a short wait; a 429 limit is not.
 */
export async function recognizeInCloud(imageUri: string): Promise<string[]> {
  const dataUrl = await toJpegDataUrl(imageUri);
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendOnce(dataUrl);
    } catch (e) {
      const status = Number(/HTTP (\d{3})/.exec(String(e))?.[1]);
      if (attempt >= 2 || !(status >= 500)) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

async function sendOnce(dataUrl: string): Promise<string[]> {
  const body = new FormData();
  body.append('base64Image', dataUrl);
  body.append('OCREngine', '2');
  body.append('scale', 'true');
  // Turns sideways cards upright before reading (binder pages often have one).
  body.append('detectOrientation', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: process.env.EXPO_PUBLIC_OCR_SPACE_KEY || DEMO_KEY },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      // OCR.space says how long to wait when the free limit is hit: {"retryAfter": 662}.
      const wait = Number((await res.json().catch(() => null))?.retryAfter);
      throw new Error(`Cloud OCR HTTP ${res.status}${wait > 0 ? ` retry ${Math.round(wait)}` : ''}`);
    }
    return splitParsedText((await res.json()) as OcrSpaceResponse);
  } finally {
    clearTimeout(timer);
  }
}

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
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH, height: null });
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

/** Runs cloud OCR on a photo and returns its text lines. Throws on failure. */
export async function recognizeInCloud(imageUri: string): Promise<string[]> {
  const dataUrl = await toJpegDataUrl(imageUri);

  const body = new FormData();
  body.append('base64Image', dataUrl);
  body.append('OCREngine', '2');
  body.append('scale', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: process.env.EXPO_PUBLIC_OCR_SPACE_KEY || DEMO_KEY },
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Cloud OCR HTTP ${res.status}`);
    return splitParsedText((await res.json()) as OcrSpaceResponse);
  } finally {
    clearTimeout(timer);
  }
}

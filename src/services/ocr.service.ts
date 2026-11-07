/**
 * On-device OCR behind a small interface.
 *
 * Uses expo-text-extractor (Apple Vision on iOS, ML Kit on Android).
 * The native module only exists in a development build — NOT in Expo Go —
 * so it is loaded lazily and failures degrade to "OCR unavailable",
 * letting the user fall back to manual search.
 *
 * Where the native module is missing (Expo Go, web), a cloud OCR fallback
 * reads the card instead, unless it is turned off (see cloud-ocr.service).
 */

import { requireOptionalNativeModule } from 'expo';

import { isCloudOcrEnabled, recognizeInCloud } from './cloud-ocr.service';

export interface OcrResult {
  lines: string[];
  available: boolean;
}

type TextExtractorModule = {
  isSupported: boolean;
  extractTextFromImage(uri: string): Promise<string[]>;
};

let cachedModule: TextExtractorModule | null | undefined;

function loadModule(): TextExtractorModule | null {
  if (cachedModule !== undefined) return cachedModule;
  // Check for the native side first: requiring the package when it is missing
  // throws inside the module system, and the dev error overlay reports that
  // even though the catch below handles it.
  if (!requireOptionalNativeModule('ExpoTextExtractor')) {
    cachedModule = null;
    return cachedModule;
  }
  try {
    // Lazy require: importing at the top level crashes in Expo Go,
    // where the native module is not linked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-text-extractor') as TextExtractorModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

function isNativeOcrAvailable(): boolean {
  const mod = loadModule();
  return !!mod && mod.isSupported !== false;
}

/** Whether any OCR (on-device, or the cloud fallback) can run. */
export function isOcrAvailable(): boolean {
  return isNativeOcrAvailable() || isCloudOcrEnabled();
}

/**
 * Run OCR on a photo and return raw text lines.
 * Never throws for "OCR missing"; only for real extraction errors
 * (including cloud network failures, which the scan screen turns into manual entry).
 */
export async function recognizeCardText(imageUri: string): Promise<OcrResult> {
  const mod = loadModule();
  let lines: string[];
  if (mod && mod.isSupported !== false) {
    lines = await mod.extractTextFromImage(imageUri);
  } else if (isCloudOcrEnabled()) {
    lines = await recognizeInCloud(imageUri);
  } else {
    return { lines: [], available: false };
  }
  return { lines: lines.filter((l) => l.trim().length > 0), available: true };
}

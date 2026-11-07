/**
 * OCR behind a small interface: the phone's own reader first, OCR.space second.
 *
 * 1. expo-text-extractor (Apple Vision on iPhone, ML Kit on Android): free,
 *    unlimited, private. The native module only exists in a development or
 *    release build, NOT in Expo Go, so it is loaded lazily.
 * 2. OCR.space (cloud) when the device reader is missing (Expo Go, web), fails,
 *    or finds almost no text (see ocr-policy.ts). Turn it off with
 *    EXPO_PUBLIC_CLOUD_OCR=off (see cloud-ocr.service).
 */

import { requireOptionalNativeModule } from 'expo';

import { isCloudOcrEnabled, recognizeInCloud } from './cloud-ocr.service';
import { needsCloudFallback } from './ocr-policy';

export interface OcrResult {
  lines: string[];
  available: boolean;
  /** Which reader produced the text (development builds show it). */
  source?: 'device' | 'cloud';
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
  const nonBlank = (lines: string[]) => lines.filter((l) => l.trim().length > 0);
  const mod = loadModule();

  if (mod && mod.isSupported !== false) {
    // 1. The phone's own reader: free, unlimited, private.
    let device: string[] | null = null;
    let deviceError: unknown;
    try {
      device = nonBlank(await mod.extractTextFromImage(imageUri));
    } catch (e) {
      deviceError = e;
    }
    if (!needsCloudFallback(device, deviceError !== undefined)) {
      return { lines: device ?? [], available: true, source: 'device' };
    }

    // 2. Fallback: OCR.space, when the device reader failed or found almost no text.
    if (!isCloudOcrEnabled()) {
      if (deviceError !== undefined) throw deviceError;
      return { lines: device ?? [], available: true, source: 'device' };
    }
    try {
      const cloud = nonBlank(await recognizeInCloud(imageUri));
      if (__DEV__) console.warn(`OCR fell back to the cloud (${deviceError ? 'device error' : 'little text'})`);
      return { lines: cloud, available: true, source: 'cloud' };
    } catch (cloudError) {
      // The device read worked but was thin (maybe an empty pocket): keep it
      // rather than failing because the cloud is unavailable or limited.
      if (deviceError === undefined && device) return { lines: device, available: true, source: 'device' };
      throw cloudError;
    }
  }

  // No device reader (Expo Go, web): the cloud is the only reader.
  if (isCloudOcrEnabled()) {
    return { lines: nonBlank(await recognizeInCloud(imageUri)), available: true, source: 'cloud' };
  }
  return { lines: [], available: false };
}

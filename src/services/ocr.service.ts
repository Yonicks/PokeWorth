/**
 * On-device OCR behind a small interface.
 *
 * Uses expo-text-extractor (Apple Vision on iOS, ML Kit on Android).
 * The native module only exists in a development build — NOT in Expo Go —
 * so it is loaded lazily and failures degrade to "OCR unavailable",
 * letting the user fall back to manual search.
 */

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

/** Whether on-device OCR can run in the current binary. */
export function isOcrAvailable(): boolean {
  const mod = loadModule();
  return !!mod && mod.isSupported !== false;
}

/**
 * Run OCR on a photo and return raw text lines.
 * Never throws for "module missing"; only for real extraction errors.
 */
export async function recognizeCardText(imageUri: string): Promise<OcrResult> {
  const mod = loadModule();
  if (!mod || mod.isSupported === false) {
    return { lines: [], available: false };
  }
  const lines = await mod.extractTextFromImage(imageUri);
  return { lines: lines.filter((l) => l.trim().length > 0), available: true };
}

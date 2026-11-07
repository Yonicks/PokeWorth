/**
 * Which OCR to trust (pure, tested in scripts/ocr-fixtures.ts).
 *
 * Order: the phone's own reader first (Apple Vision on iPhone, ML Kit on
 * Android; free, unlimited, private, development and release builds only),
 * then OCR.space as the fallback (the only reader in Expo Go and on web).
 */

/** Fewer letters and digits than this counts as "the device read nothing useful". */
export const MIN_DEVICE_CHARS = 6;

export function textCharCount(lines: string[]): number {
  return lines.join('').replace(/[^\p{L}\p{N}]/gu, '').length;
}

/**
 * Whether the cloud should be asked after an on-device read: the reader
 * failed, or it returned almost no text (glare, a very dark photo).
 */
export function needsCloudFallback(deviceLines: string[] | null, deviceFailed: boolean): boolean {
  return deviceFailed || deviceLines === null || textCharCount(deviceLines) < MIN_DEVICE_CHARS;
}

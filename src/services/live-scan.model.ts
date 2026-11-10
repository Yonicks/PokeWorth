/**
 * Auto-scan (S4): the camera keeps taking small photos, the phone reads each one, and the scan
 * is accepted by itself once the same card is matched confidently in consecutive frames.
 * Pure rules only; the loop itself lives in the scan screen.
 */

/** Consecutive frames that must agree on one card before it is accepted. */
export const FRAMES_TO_ACCEPT = 2;
/** Pause between frames, so the camera and the reader are not hammered. */
export const FRAME_GAP_MS = 250;
/** JPEG quality of a frame: smaller than a manual photo, still sharp enough to read. */
export const FRAME_QUALITY = 0.5;
/** Auto-scan stops by itself after this long without an accepted card, to save battery. */
export const AUTO_TIMEOUT_MS = 60_000;

/**
 * Without the phone's own reader (Expo Go, web) every frame goes to OCR.space, which allows
 * 500 requests a day. So frames come slower and auto-scan gives up sooner.
 */
export const CLOUD_FRAME_GAP_MS = 2500;
export const CLOUD_FRAME_QUALITY = 0.7;
export const CLOUD_TIMEOUT_MS = 20_000;

export interface AutoSettings {
  gapMs: number;
  quality: number;
  timeoutMs: number;
}

export function autoSettings(deviceReader: boolean): AutoSettings {
  return deviceReader
    ? { gapMs: FRAME_GAP_MS, quality: FRAME_QUALITY, timeoutMs: AUTO_TIMEOUT_MS }
    : { gapMs: CLOUD_FRAME_GAP_MS, quality: CLOUD_FRAME_QUALITY, timeoutMs: CLOUD_TIMEOUT_MS };
}

/** OCR.space answers "HTTP 429" when the day's free requests are used up. */
export function isRateLimit(error: unknown): boolean {
  return /HTTP 429/.test(String(error));
}

export type StopReason = 'timeout' | 'limit';

export function stopText(reason: StopReason, deviceReader: boolean): string {
  if (reason === 'limit') return 'Cloud reading limit reached for now. Use the shutter, or try later';
  return deviceReader ? 'Auto-scan stopped. Tap to start again' : 'No card found. Tap Auto-scan to try again';
}

export interface Streak {
  cardId?: string;
  count: number;
}

export const emptyStreak: Streak = { count: 0 };

/**
 * Folds one frame's confident card id (undefined when the frame had no confident match) into
 * the streak. A different card, or no match, starts over: a card in motion or a hand moving
 * past never accepts.
 */
export function nextStreak(streak: Streak, cardId: string | undefined): Streak {
  if (!cardId) return emptyStreak;
  return streak.cardId === cardId ? { cardId, count: streak.count + 1 } : { cardId, count: 1 };
}

export function isAccepted(streak: Streak, needed: number = FRAMES_TO_ACCEPT): boolean {
  return !!streak.cardId && streak.count >= needed;
}

/** Whether a frame read anything worth matching (a name or a collector number). */
export function hasReadableCard(parsed: { name?: string; localId?: string }): boolean {
  return !!parsed.name || !!parsed.localId;
}

/** Status line under the guide frame. */
export function autoStatusText(streak: Streak, frames: number): string {
  if (streak.cardId) return 'Hold still…';
  return frames === 0 ? 'Auto-scan on. Hold the card in the frame' : 'Looking for a card…';
}

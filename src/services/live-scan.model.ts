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

/**
 * Binder scan pocket statuses (step 2), pure so they are tested offline.
 *
 * - sure: the matcher's confidence rule passed (≥ 85 % and ≥ 15 points ahead);
 *   starts ticked on the review grid.
 * - check: there is a best guess, but you tick it yourself (decision 3).
 * - notfound: text was read but no catalog card matched.
 * - empty: almost no text, so the pocket is taken as empty and not matched.
 * - error: reading or matching failed (network, OCR limit); can be retried.
 */

import type { MatchOutcome } from './card-matcher.service';

export type PocketStatus = 'sure' | 'check' | 'notfound' | 'empty' | 'error';

/** A pocket with fewer readable characters than this is treated as empty. */
export const EMPTY_TEXT_CHARS = 6;

/** Letters and digits in the OCR text, ignoring spaces and symbols. */
export function textChars(lines: string[]): number {
  return lines.join('').replace(/[^\p{L}\p{N}]/gu, '').length;
}

export function classifyPocket(lines: string[], outcome: MatchOutcome | null): PocketStatus {
  if (textChars(lines) < EMPTY_TEXT_CHARS) return 'empty';
  if (!outcome || outcome.candidates.length === 0) return 'notfound';
  return outcome.confidentCardId ? 'sure' : 'check';
}

/** Whether a pocket starts ticked on the review grid. */
export function startsTicked(status: PocketStatus): boolean {
  return status === 'sure';
}

/** Whether a pocket's error text is the OCR reading limit (every later pocket would fail too). */
export function isLimitError(text: string | undefined): boolean {
  return !!text && /reading limit/i.test(text);
}

/** Shown for pockets never read because reading stopped early. */
export const NOT_READ_TEXT = 'Not read yet. Tap Retry.';

/** A short reason for a failed pocket, in words the user understands. */
export function pocketErrorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/\b429\b|rate|limit/i.test(msg)) {
    const seconds = Number(/retry (\d+)/.exec(msg)?.[1]);
    return seconds > 0
      ? `Reading limit reached. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} min.`
      : 'Reading limit reached. Try again in a few minutes.';
  }
  if (/abort|timeout/i.test(msg)) return 'Reading took too long.';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'No connection.';
  return 'Could not read this pocket.';
}

export interface QueueOptions<R> {
  /** Pockets read at the same time (step 0: 3 keeps the OCR service happy). */
  concurrency?: number;
  /** Stop starting new work when aborted; work already running finishes. */
  signal?: AbortSignal;
  /** Called as each item finishes, in completion order. */
  onResult?: (result: R, index: number) => void;
}

/**
 * Run `worker` over `items` with limited concurrency. Results come back in
 * item order; items never started because of a cancel are left undefined.
 * The worker must not throw (turn failures into results).
 */
export async function runQueue<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  { concurrency = 3, signal, onResult }: QueueOptions<R> = {},
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length).fill(undefined);
  let next = 0;
  const lane = async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      const r = await worker(items[i], i);
      results[i] = r;
      onResult?.(r, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane));
  return results;
}

export interface PageSummary {
  sure: number;
  check: number;
  notfound: number;
  empty: number;
  error: number;
  /** Pockets the user can add (sure + check). */
  found: number;
}

export function summarize(statuses: PocketStatus[]): PageSummary {
  const s: PageSummary = { sure: 0, check: 0, notfound: 0, empty: 0, error: 0, found: 0 };
  for (const st of statuses) s[st]++;
  s.found = s.sure + s.check;
  return s;
}

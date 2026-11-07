/**
 * Read and match every pocket of a binder page (binder scan, step 2).
 * Cropping is binder-crop.service; statuses and the queue are in
 * binder-scan.model (tested offline); reading and matching reuse the
 * single-card scan (ocr.service, card-matcher.service).
 */

import type { PocketImage } from './binder-crop.service';
import {
  classifyPocket,
  pocketErrorText,
  runQueue,
  type PocketStatus,
} from './binder-scan.model';
import { matchCard, parseOcrLines, type MatchOutcome } from './card-matcher.service';
import { recognizeCardText } from './ocr.service';

export interface PocketResult {
  index: number;
  row: number;
  col: number;
  /** The pocket's cropped image. */
  uri: string;
  status: PocketStatus;
  lines: string[];
  outcome?: MatchOutcome;
  /** Set when status is "error". */
  error?: string;
}

/** Read and match one pocket; failures become an "error" result, never a throw. */
export async function readPocket(pocket: PocketImage): Promise<PocketResult> {
  const base = { index: pocket.index, row: pocket.row, col: pocket.col, uri: pocket.uri };
  try {
    const ocr = await recognizeCardText(pocket.uri);
    if (!ocr.available) {
      return { ...base, status: 'error', lines: [], error: 'Card reading is not available on this device.' };
    }
    const parsed = parseOcrLines(ocr.lines);
    const outcome = parsed.name || parsed.localId ? await matchCard(parsed) : undefined;
    return { ...base, status: classifyPocket(ocr.lines, outcome ?? null), lines: ocr.lines, outcome };
  } catch (error) {
    return { ...base, status: 'error', lines: [], error: pocketErrorText(error) };
  }
}

/**
 * Read every pocket, three at a time. `onResult` fires as each pocket
 * finishes so the screen can fill in; cancel with `signal`.
 */
export function readPockets(
  pockets: PocketImage[],
  options: { signal?: AbortSignal; onResult?: (r: PocketResult) => void; concurrency?: number } = {},
): Promise<(PocketResult | undefined)[]> {
  return runQueue(pockets, readPocket, {
    concurrency: options.concurrency ?? 3,
    signal: options.signal,
    onResult: (r) => options.onResult?.(r),
  });
}

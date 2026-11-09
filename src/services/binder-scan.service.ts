/**
 * Read and match every pocket of a binder page (binder scan, step 2).
 * Cropping is binder-crop.service; statuses and the queue are in
 * binder-scan.model (tested offline); reading and matching reuse the
 * single-card scan (ocr.service, card-matcher.service).
 */

import { cropBottomStrip, type PocketImage } from './binder-crop.service';
import {
  classifyPocket,
  isLimitError,
  NOT_READ_TEXT,
  pocketErrorText,
  runQueue,
  shouldRereadNumber,
  type PocketStatus,
} from './binder-scan.model';
import {
  isPrintingUnsure,
  matchCard,
  mergeNumber,
  parseOcrLines,
  type MatchOutcome,
} from './card-matcher.service';
import { recognizeCardText } from './ocr.service';

/**
 * Flag: EXPO_PUBLIC_BINDER_NUMBER_REREAD=on in .env.local turns the number
 * re-read back on (restart Expo with --clear after changing it).
 */
export const REREAD_NUMBER = process.env.EXPO_PUBLIC_BINDER_NUMBER_REREAD === 'on';

export interface PocketResult {
  index: number;
  row: number;
  col: number;
  /** The pocket's cropped image. */
  uri: string;
  status: PocketStatus;
  lines: string[];
  outcome?: MatchOutcome;
  /** The printing is a guess: no collector number was read. */
  unsure?: boolean;
  /** The number came from the second, close-up read of the bottom strip. */
  numberFromStrip?: boolean;
  /** Set when status is "error". */
  error?: string;
  /** Scan log (S0): time spent reading the text and matching it, in ms. */
  ocrMs?: number;
  matchMs?: number;
}

/**
 * Read and match one pocket; failures become an "error" result, never a throw.
 * When the first read leaves the card unsure and no collector number was
 * found, the bottom strip is read again close up (one extra OCR request): the
 * number often decides which printing it is.
 */
export async function readPocket(pocket: PocketImage): Promise<PocketResult> {
  const base = { index: pocket.index, row: pocket.row, col: pocket.col, uri: pocket.uri };
  try {
    const ocrStart = Date.now();
    const ocr = await recognizeCardText(pocket.uri);
    const ocrMs = Date.now() - ocrStart;
    if (!ocr.available) {
      return { ...base, status: 'error', lines: [], error: 'Card reading is not available on this device.' };
    }
    let lines = ocr.lines;
    let parsed = parseOcrLines(lines);
    const matchStart = Date.now();
    let outcome = parsed.name || parsed.localId ? await matchCard(parsed) : undefined;
    const matchMs = Date.now() - matchStart;
    let status = classifyPocket(lines, outcome ?? null);
    let numberFromStrip = false;

    // Optional second read of the bottom strip for the collector number (flag
    // REREAD_NUMBER, off by default): only pockets whose printing is still a guess.
    if (
      shouldRereadNumber({
        enabled: REREAD_NUMBER,
        status,
        numberRead: !!parsed.localId,
        printingUnsure: !!outcome && isPrintingUnsure(outcome),
        hasOutcome: !!outcome,
      })
    ) {
      try {
        const strip = await recognizeCardText(await cropBottomStrip(pocket.uri));
        const merged = mergeNumber(parsed, strip.lines);
        if (merged.localId) {
          const better = await matchCard(merged);
          if (better.candidates.length > 0) {
            // Shown in the pocket sheet in development builds.
            lines = [...lines, ...strip.lines.map((l) => `[strip] ${l}`)];
            parsed = merged;
            outcome = better;
            status = classifyPocket(parsed.rawLines, outcome);
            numberFromStrip = true;
          }
        }
      } catch (e) {
        // The close-up is a bonus; the first read stands if it fails.
        if (__DEV__) console.warn(`Binder pocket ${pocket.index} strip read failed`, e);
      }
    }
    return {
      ...base,
      status,
      lines,
      outcome,
      ocrMs,
      matchMs,
      numberFromStrip,
      unsure: !!outcome && (status === 'check' || status === 'sure') && isPrintingUnsure(outcome),
    };
  } catch (error) {
    // The pocket shows friendly text; developers get the real cause.
    if (__DEV__) console.warn(`Binder pocket ${pocket.index} failed`, error);
    return { ...base, status: 'error', lines: [], error: pocketErrorText(error) };
  }
}

/**
 * Read every pocket, three at a time. `onResult` fires as each pocket
 * finishes so the screen can fill in; cancel with `signal`.
 */
export async function readPockets(
  pockets: PocketImage[],
  options: { signal?: AbortSignal; onResult?: (r: PocketResult) => void; concurrency?: number } = {},
): Promise<PocketResult[]> {
  // Stop on the OCR reading limit: every later pocket would fail the same way.
  const limit = new AbortController();
  options.signal?.addEventListener('abort', () => limit.abort());
  const results = await runQueue(pockets, readPocket, {
    concurrency: options.concurrency ?? 3,
    signal: limit.signal,
    onResult: (r) => {
      if (r.status === 'error' && isLimitError(r.error)) limit.abort();
      options.onResult?.(r);
    },
  });
  // Pockets never started (stopped early) are reported, so Retry can read them.
  return results.map(
    (r, i) =>
      r ?? {
        index: pockets[i].index,
        row: pockets[i].row,
        col: pockets[i].col,
        uri: pockets[i].uri,
        status: 'error' as const,
        lines: [],
        error: NOT_READ_TEXT,
      },
  );
}

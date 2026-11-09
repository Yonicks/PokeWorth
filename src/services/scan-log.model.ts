/**
 * Scan log rules (S0), kept pure so they can be tested offline.
 *
 * Every card scan and binder page writes one entry: how long each step took
 * and what was read, so a slow or wrong scan can be traced to its step. The
 * "Wrong card" button adds the card that was shown, and the card the user then
 * opened is the correction; both make real test cases for the matcher.
 * Saved on the phone only (scan-log.service.ts); nothing is sent anywhere.
 */

export interface ScanLogEntry {
  id: string;
  /** ISO time the scan finished reading. */
  at: string;
  kind: 'card' | 'binder';
  /** Milliseconds per step; missing when the step did not run (an imported photo has no camera step). */
  photoMs?: number;
  readMs?: number;
  matchMs?: number;
  /** Binder pages: wall-clock time for the whole page. */
  totalMs?: number;
  ocr?: 'device' | 'cloud';
  /** Text lines as read (single cards only). */
  lines: string[];
  name?: string;
  number?: string;
  total?: number;
  /** What the matcher put first, and whether it would have skipped confirmation. */
  topCardId?: string;
  candidates?: number;
  confident?: boolean;
  /** The card the user opened from Confirm, or after pressing "Wrong card". */
  openedCardId?: string;
  /** The user said this card was wrong. */
  wrongCardId?: string;
  /** Binder pages: pockets per status ("sure": 5, "check": 3, ...). */
  pockets?: Record<string, number>;
}

export const MAX_LOG_ENTRIES = 60;

function isEntry(e: unknown): e is ScanLogEntry {
  if (!e || typeof e !== 'object') return false;
  const x = e as Partial<ScanLogEntry>;
  return typeof x.id === 'string' && typeof x.at === 'string' && (x.kind === 'card' || x.kind === 'binder') && Array.isArray(x.lines);
}

/** Read stored JSON; anything unreadable gives an empty log instead of a crash. */
export function parseScanLog(raw: string | null | undefined): ScanLogEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isEntry).slice(0, MAX_LOG_ENTRIES) : [];
  } catch {
    return [];
  }
}

/** Newest first, capped. */
export function addEntry(log: ScanLogEntry[], entry: ScanLogEntry): ScanLogEntry[] {
  return [entry, ...log.filter((e) => e.id !== entry.id)].slice(0, MAX_LOG_ENTRIES);
}

/** Merge fields into one entry; an unknown id changes nothing. */
export function patchEntry(log: ScanLogEntry[], id: string, patch: Partial<Omit<ScanLogEntry, 'id'>>): ScanLogEntry[] {
  return log.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

/** "850 ms", "1.8 s", "12 s". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}

/** One line of step times, e.g. "photo 0.4 s · read 1.8 s · match 900 ms". */
export function timingText(e: ScanLogEntry): string {
  const parts: string[] = [];
  const add = (label: string, ms?: number) => {
    if (ms !== undefined) parts.push(`${label} ${formatMs(ms)}`);
  };
  add('photo', e.photoMs);
  add(e.kind === 'binder' ? 'read per pocket' : 'read', e.readMs);
  add(e.kind === 'binder' ? 'match per pocket' : 'match', e.matchMs);
  add('page total', e.totalMs);
  return parts.join(' · ') || 'no timings';
}

export type Verdict = 'wrong' | 'fixed' | 'picked-other' | 'unconfirmed' | 'matched';

/**
 * How the scan ended for the user:
 * - wrong: pressed "Wrong card" and has not opened another card yet
 * - fixed: pressed "Wrong card", then opened a different card
 * - picked-other: opened a card the matcher did not rank first
 * - matched: opened the card the matcher ranked first
 * - unconfirmed: nothing opened (yet), or a binder page
 */
export function verdictOf(e: ScanLogEntry): Verdict {
  if (e.wrongCardId) return e.openedCardId && e.openedCardId !== e.wrongCardId ? 'fixed' : 'wrong';
  if (e.openedCardId && e.topCardId) return e.openedCardId === e.topCardId ? 'matched' : 'picked-other';
  return 'unconfirmed';
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  wrong: 'Wrong card',
  fixed: 'Corrected',
  'picked-other': 'Picked another',
  matched: 'Matched',
  unconfirmed: 'Not opened',
};

/** Whole log as JSON text, for copying into a bug report or a fixture. */
export function toReport(log: ScanLogEntry[]): string {
  return JSON.stringify(log, null, 2);
}

/** Median of the values, or undefined for none. */
export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Typical time per step across card scans, for the summary at the top of the log. */
export function typicalTimings(log: ScanLogEntry[]): { photoMs?: number; readMs?: number; matchMs?: number; count: number } {
  const cards = log.filter((e) => e.kind === 'card');
  const pick = (f: (e: ScanLogEntry) => number | undefined) =>
    median(cards.map(f).filter((v): v is number => v !== undefined));
  return { photoMs: pick((e) => e.photoMs), readMs: pick((e) => e.readMs), matchMs: pick((e) => e.matchMs), count: cards.length };
}

/** Counts per status for a binder page entry. */
export function countStatuses(statuses: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of statuses) out[s] = (out[s] ?? 0) + 1;
  return out;
}

/**
 * Scan log storage (AsyncStorage, key `pokeworth.scanlog.v1`). Logging must
 * never get in the way of scanning: every function here swallows its errors.
 * Writes run one at a time, so a patch always lands after the entry it patches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { addEntry, parseScanLog, patchEntry, type ScanLogEntry } from './scan-log.model';

const KEY = 'pokeworth.scanlog.v1';

let queue: Promise<unknown> = Promise.resolve();

function enqueue(work: () => Promise<void>): Promise<void> {
  const next = queue.then(work).catch(() => {});
  queue = next;
  return next;
}

export async function loadScanLog(): Promise<ScanLogEntry[]> {
  try {
    return parseScanLog(await AsyncStorage.getItem(KEY));
  } catch {
    return [];
  }
}

async function change(update: (log: ScanLogEntry[]) => ScanLogEntry[]): Promise<void> {
  await enqueue(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(update(await loadScanLog())));
  });
}

/** Adds an entry and returns its id at once; the write finishes in the background. */
export function logScan(entry: Omit<ScanLogEntry, 'id' | 'at'> & { at?: string }): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const full: ScanLogEntry = { ...entry, id, at: entry.at ?? new Date().toISOString() };
  void change((log) => addEntry(log, full));
  return id;
}

/** Adds facts to an entry (match result, the card the user opened, "wrong card"). */
export function updateScanLog(id: string | undefined, patch: Partial<Omit<ScanLogEntry, 'id'>>): Promise<void> {
  if (!id) return Promise.resolve();
  return change((log) => patchEntry(log, id, patch));
}

export async function getScanEntry(id: string | undefined): Promise<ScanLogEntry | undefined> {
  if (!id) return undefined;
  await queue;
  return (await loadScanLog()).find((e) => e.id === id);
}

export async function clearScanLog(): Promise<void> {
  await enqueue(async () => {
    await AsyncStorage.removeItem(KEY);
  });
}

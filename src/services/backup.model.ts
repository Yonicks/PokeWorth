/**
 * Backup file rules, pure (no storage, no React) so they can be tested offline.
 *
 * A backup is one JSON file holding the collection, the recorded price history
 * and the chosen display currency. Reading one never trusts its content: the
 * collection and history go through the same parsers the app uses for its own
 * storage, so broken entries are dropped instead of crashing.
 */

import {
  parseCollection,
  type CollectionEntry,
  type CollectionState,
} from './collection.model';
import { emptyHistory, parseHistory, type HistoryState } from './history.model';

export const BACKUP_FORMAT = 'pokeworth-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  collection: CollectionState;
  history: HistoryState;
  /** Display currency setting, when the file has a valid one. */
  currency?: string;
}

export interface BackupSummary {
  portfolios: number;
  entries: number;
  copies: number;
  favorites: number;
  historySeries: number;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  return {
    portfolios: data.collection.portfolios.length,
    entries: data.collection.entries.length,
    copies: data.collection.entries.reduce((n, e) => n + e.quantity, 0),
    favorites: data.collection.favorites.length,
    historySeries: Object.keys(data.history.cards).length,
  };
}

export function buildBackup(data: BackupData, now = new Date().toISOString()): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      collection: data.collection,
      history: data.history,
      currency: data.currency,
    },
    null,
    1,
  );
}

export type ParsedBackup = { ok: true; data: BackupData } | { ok: false; error: string };

const CURRENCIES = ['USD', 'EUR', 'original'];

export function parseBackup(raw: string | null | undefined): ParsedBackup {
  if (!raw || !raw.trim()) return { ok: false, error: 'The file is empty.' };
  let file: unknown;
  try {
    file = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'This is not a PokeWorth backup file.' };
  }
  const f = file as Record<string, unknown> | null;
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This is not a PokeWorth backup file.' };
  }
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup comes from a newer version of PokeWorth. Update the app first.' };
  }
  if (!f.collection || typeof f.collection !== 'object') {
    return { ok: false, error: 'The backup has no collection in it.' };
  }
  return {
    ok: true,
    data: {
      collection: parseCollection(JSON.stringify(f.collection)),
      history: f.history ? parseHistory(JSON.stringify(f.history)) : emptyHistory(),
      currency: typeof f.currency === 'string' && CURRENCIES.includes(f.currency) ? f.currency : undefined,
    },
  };
}

/**
 * Add a backup into what is on the phone. Nothing is lost: portfolios and
 * favourites are joined, a card both sides have keeps the larger quantity,
 * and price series only come from the backup when the phone has none.
 */
export function mergeBackup(current: BackupData, incoming: BackupData): BackupData {
  const portfolios = [...current.collection.portfolios];
  for (const p of incoming.collection.portfolios) {
    if (!portfolios.some((x) => x.id === p.id)) portfolios.push(p);
  }
  const byId = new Map<string, CollectionEntry>(current.collection.entries.map((e) => [e.id, e]));
  for (const e of incoming.collection.entries) {
    const have = byId.get(e.id);
    if (!have) byId.set(e.id, e);
    else if (!e.graded && e.quantity > have.quantity) byId.set(e.id, { ...have, quantity: e.quantity });
  }
  const favorites = [...new Set([...current.collection.favorites, ...incoming.collection.favorites])];

  const cards = { ...incoming.history.cards, ...current.history.cards };
  const portfolioSeries = { ...incoming.history.portfolios, ...current.history.portfolios };

  return {
    collection: {
      ...current.collection,
      portfolios,
      entries: [...byId.values()],
      favorites,
    },
    history: { ...current.history, cards, portfolios: portfolioSeries },
    currency: current.currency ?? incoming.currency,
  };
}

/** File name such as pokeworth-backup-2026-11-08.json. */
export function backupFileName(day: string): string {
  return `pokeworth-backup-${day}.json`;
}

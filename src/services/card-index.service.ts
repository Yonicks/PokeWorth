/**
 * Downloads, stores and loads the on-device card index (see card-index.model.ts).
 * Nothing here may break scanning: every function resolves, never throws, and when there
 * is no index the matcher simply keeps using the TCGdex API.
 *
 * Storage: a file on the phone (an AsyncStorage row of this size is near Android's
 * 2 MB limit); AsyncStorage on the web, which has no file system.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { fetchWithTimeout } from './api-error';
import { getCardIndex, setCardIndex } from './card-index.holder';
import {
  assembleIndex,
  buildIndex,
  isStale,
  MIN_PLAUSIBLE_CARDS,
  parseStoredIndex,
  type CardIndex,
  type RawCard,
  type RawSet,
  type StoredIndex,
} from './card-index.model';

const GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql';
const SETS_URL = 'https://api.tcgdex.net/v2/en/sets';
const FILE_NAME = 'card-index-v1.json';
const WEB_KEY = 'pokeworth.cardindex.v1';
/** The whole card list is 3.8 MB; allow a slow connection a minute. */
const DOWNLOAD_TIMEOUT_MS = 90_000;

async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(WEB_KEY);
    const file = new File(Paths.document, FILE_NAME);
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}

async function writeStored(text: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(WEB_KEY, text);
      return;
    }
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) file.create();
    await file.write(text);
  } catch {
    // Not stored: the index still works for this session.
  }
}

async function graphql<T>(query: string): Promise<T> {
  const res = await fetchWithTimeout(
    GRAPHQL_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
    },
    DOWNLOAD_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`TCGdex GraphQL failed (${res.status})`);
  const body = (await res.json()) as { data?: T };
  if (!body.data) throw new Error('TCGdex GraphQL sent no data');
  return body.data;
}

async function download(): Promise<StoredIndex> {
  const [cards, sets, order] = await Promise.all([
    graphql<{ cards: RawCard[] }>(`{ cards { id localId name hp attacks { name } } }`),
    graphql<{ sets: RawSet[] }>(`{ sets { id name serie { id } cardCount { official } } }`),
    fetchWithTimeout(SETS_URL, { headers: { Accept: 'application/json' } }, DOWNLOAD_TIMEOUT_MS).then(
      async (r) => ((await r.json()) as { id: string }[]).map((s) => s.id),
    ),
  ]);
  return assembleIndex(cards.cards, sets.sets, order, new Date().toISOString());
}

let loading: Promise<CardIndex | null> | null = null;
let refreshing: Promise<boolean> | null = null;

/** Reads the stored index into memory. Null when there is none (or it is damaged). */
export function loadCardIndex(): Promise<CardIndex | null> {
  loading ??= (async () => {
    const stored = parseStoredIndex(await readStored());
    if (!stored) return null;
    const index = buildIndex(stored);
    setCardIndex(index);
    return index;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/**
 * Downloads a fresh index and swaps it in. Returns false when the download failed or looked
 * broken; the previous index (if any) stays in use.
 */
export function refreshCardIndex(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const stored = await download();
      if (stored.rows.length < MIN_PLAUSIBLE_CARDS) return false;
      setCardIndex(buildIndex(stored));
      await writeStored(JSON.stringify(stored));
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Call once at start-up. Loads the stored index at once (scans can use it straight away),
 * then refreshes in the background when there is none or it is old. Never waits for the
 * download, so a first launch scans through the API exactly as before.
 */
export async function ensureCardIndex(): Promise<void> {
  const index = getCardIndex() ?? (await loadCardIndex());
  if (!index || isStale(index.builtAt)) void refreshCardIndex();
}

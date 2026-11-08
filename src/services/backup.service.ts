/**
 * Backup export and import (Profile). Rules live in backup.model.ts; this file
 * reads the stored data, writes the file, shares it, and puts a chosen backup back.
 *
 * Phone: the file goes through the share sheet (Files, Drive, email, AirDrop...)
 * and comes back through the system file picker. Web: a download and a file input.
 */

import type { QueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  backupFileName,
  buildBackup,
  mergeBackup,
  parseBackup,
  type BackupData,
} from './backup.model';
import { loadCollection, updateCollection } from './collection.service';
import { loadHistory, updateHistory } from './history.service';
import { dayKey } from './history.model';
import { loadSettings, saveSettings } from './settings.service';
import type { DisplayCurrency } from './currency.model';

export async function currentData(): Promise<BackupData> {
  const [collection, history, settings] = await Promise.all([loadCollection(), loadHistory(), loadSettings()]);
  return { collection, history, currency: settings.currency };
}

export type ExportResult = { ok: true; name: string } | { ok: false; error: string };

export async function exportBackup(): Promise<ExportResult> {
  try {
    const name = backupFileName(dayKey());
    const text = buildBackup(await currentData());
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true, name };
    }
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: 'Sharing is not available on this device.' };
    }
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Save your PokeWorth backup',
    });
    return { ok: true, name };
  } catch {
    return { ok: false, error: 'Could not create the backup file.' };
  }
}

export type PickResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: string; cancelled?: boolean };

/** Let the user choose a backup file and check it. Nothing is changed yet. */
export async function pickBackup(): Promise<PickResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return { ok: false, error: '', cancelled: true };
    const asset = picked.assets[0];
    const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
    const parsed = parseBackup(text);
    return parsed.ok ? { ok: true, data: parsed.data } : { ok: false, error: parsed.error };
  } catch {
    return { ok: false, error: 'Could not read that file.' };
  }
}

/** Put a backup on the phone, either joined with what is there or instead of it. */
export async function applyBackup(client: QueryClient, incoming: BackupData, mode: 'merge' | 'replace'): Promise<void> {
  const current = await currentData();
  const next = mode === 'merge' ? mergeBackup(current, incoming) : incoming;
  const collection = await updateCollection(() => next.collection);
  const history = await updateHistory(() => next.history);
  client.setQueryData(['collection'], collection);
  client.setQueryData(['history'], history);
  if (next.currency === 'USD' || next.currency === 'EUR' || next.currency === 'original') {
    client.setQueryData(['settings'], await saveSettings({ currency: next.currency as DisplayCurrency }));
  }
}

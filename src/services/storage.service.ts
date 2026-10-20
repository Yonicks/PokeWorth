/**
 * Local persistence (AsyncStorage). Currently: recent scan history.
 * Collection features (P1) will extend this service.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentScan } from '../types/card';

const RECENT_SCANS_KEY = 'pokeworth.recentScans.v1';
const MAX_RECENT_SCANS = 25;

export async function getRecentScans(): Promise<RecentScan[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentScan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecentScan(scan: RecentScan): Promise<void> {
  const existing = await getRecentScans();
  const deduped = existing.filter((s) => s.cardId !== scan.cardId);
  const next = [scan, ...deduped].slice(0, MAX_RECENT_SCANS);
  await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
}

export async function clearRecentScans(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_SCANS_KEY);
}

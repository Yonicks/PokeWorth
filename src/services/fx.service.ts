/**
 * EUR→USD rate from the European Central Bank via the free Frankfurter API
 * (no key; https://frankfurter.dev). Checked 2026-11-07: CORS allowed, cached
 * for a day by the server. The last good rate is kept on the device so totals
 * still convert offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FxRate } from './currency.model';

const URL = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD';
const KEY = 'pokeworth.fx.v1';

export async function getFxRate(): Promise<FxRate | null> {
  try {
    const res = await fetch(URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = (await res.json()) as { date?: string; rates?: { USD?: number } };
    const eurUsd = data.rates?.USD;
    if (typeof eurUsd !== 'number' || !(eurUsd > 0) || typeof data.date !== 'string') throw new Error('Bad FX data');
    const rate: FxRate = { eurUsd, date: data.date };
    AsyncStorage.setItem(KEY, JSON.stringify(rate)).catch(() => undefined);
    return rate;
  } catch {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as FxRate) : null;
      return saved && saved.eurUsd > 0 ? saved : null;
    } catch {
      return null;
    }
  }
}

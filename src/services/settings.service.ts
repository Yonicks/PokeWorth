/** App settings stored on the device (`pokeworth.settings.v1`). */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DisplayCurrency } from './currency.model';

export interface Settings {
  currency: DisplayCurrency;
}

const KEY = 'pokeworth.settings.v1';
export const DEFAULT_SETTINGS: Settings = { currency: 'USD' };

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const currency = data.currency === 'EUR' || data.currency === 'original' ? data.currency : 'USD';
    return { currency };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  return settings;
}

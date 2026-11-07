/** Price history, exchange rate and settings as shared query-cache entries. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { CollectionState } from '@/services/collection.model';
import { convertTotals, type DisplayCurrency } from '@/services/currency.model';
import { getFxRate } from '@/services/fx.service';
import type { HistoryState } from '@/services/history.model';
import { loadHistory, runDailySnapshot, updateHistory, withCard } from '@/services/history.service';
import { loadSettings, saveSettings } from '@/services/settings.service';
import type { Card } from '@/types/card';

import { useCollection, useUpdateCollection } from './use-collection';

export const HISTORY_KEY = ['history'] as const;

export function useHistory() {
  return useQuery({ queryKey: HISTORY_KEY, queryFn: loadHistory, staleTime: Infinity });
}

/** Record today's prices for a card whenever its page is opened. */
export function useRecordCard(card: Card | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    if (!card) return;
    updateHistory((h) => withCard(h, card))
      .then((saved) => client.setQueryData<HistoryState>(HISTORY_KEY, saved))
      .catch(() => undefined);
  }, [card, client]);
}

/**
 * Once a day (on first open, and when the app comes back to the
 * foreground on a new day) refresh owned cards' prices and record them.
 */
export function useDailySnapshot() {
  const client = useQueryClient();
  const collection = useCollection();
  const update = useUpdateCollection();
  const state = collection.data;

  useEffect(() => {
    if (!state) return;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const change = await runDailySnapshot(client, client.getQueryData<CollectionState>(['collection']) ?? state);
        if (change) await update.mutateAsync(change);
        client.setQueryData(HISTORY_KEY, await loadHistory());
      } catch {
        // Offline or a catalog error: try again next time the app opens.
      } finally {
        running = false;
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
    // Run once the collection has loaded; later changes are handled by the day check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);
}

export function useFxRate() {
  return useQuery({
    queryKey: ['fx'],
    queryFn: getFxRate,
    // ECB publishes once per working day.
    staleTime: 1000 * 60 * 60 * 6,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: loadSettings, staleTime: Infinity });
}

export function useSetCurrency() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (currency: DisplayCurrency) => saveSettings({ currency }),
    onSuccess: (saved) => client.setQueryData(['settings'], saved),
  });
}

/** Per-currency totals shown in the user's display currency. */
export function useDisplayTotals(byCurrency: Record<string, number>) {
  const settings = useSettings();
  const fx = useFxRate();
  const currency = settings.data?.currency ?? 'USD';
  return { ...convertTotals(byCurrency, currency, fx.data ?? undefined), fx: fx.data ?? undefined, target: currency };
}

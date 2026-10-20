/** TanStack Query hooks around the card services. */

import { useQuery } from '@tanstack/react-query';

import { matchCard } from '@/services/card-matcher.service';
import { getCard, searchCardsByName } from '@/services/tcgdex.service';
import { getRecentScans } from '@/services/storage.service';
import type { ParsedCardText } from '@/types/card';

export function useCardSearch(name: string) {
  return useQuery({
    queryKey: ['cardSearch', name.trim().toLowerCase()],
    queryFn: () => searchCardsByName(name),
    enabled: name.trim().length >= 3,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCard(id: string | undefined) {
  return useQuery({
    queryKey: ['card', id],
    queryFn: () => getCard(id as string),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCardMatch(parsed: ParsedCardText | null) {
  return useQuery({
    queryKey: ['cardMatch', parsed?.name ?? '', parsed?.localId ?? '', parsed?.setTotal ?? 0],
    queryFn: () => matchCard(parsed as ParsedCardText),
    enabled: !!parsed && (!!parsed.name || !!parsed.localId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useRecentScans() {
  return useQuery({
    queryKey: ['recentScans'],
    queryFn: getRecentScans,
    staleTime: 0,
  });
}

/** The saved collection as a TanStack Query cache entry shared by every screen. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CollectionState } from '@/services/collection.model';
import { loadCollection, updateCollection } from '@/services/collection.service';
import { updateHistory, withPortfolios } from '@/services/history.service';

const KEY = ['collection'] as const;

export function useCollection() {
  return useQuery({ queryKey: KEY, queryFn: loadCollection, staleTime: Infinity });
}

/**
 * Apply a pure change (from collection.model) and save it. The cache is
 * updated straight away so steppers feel instant, then replaced by what was
 * actually saved.
 */
export function useUpdateCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: (s: CollectionState) => CollectionState) => updateCollection(change),
    onMutate: (change) => {
      const current = client.getQueryData<CollectionState>(KEY);
      if (current) client.setQueryData(KEY, change(current));
      return { current };
    },
    onError: (_e, _change, ctx) => {
      if (ctx?.current) client.setQueryData(KEY, ctx.current);
    },
    onSuccess: (saved) => {
      client.setQueryData(KEY, saved);
      // Keep today's portfolio-value point in step with what was saved.
      updateHistory((h) => withPortfolios(h, saved))
        .then((h) => client.setQueryData(['history'], h))
        .catch(() => undefined);
    },
  });
}

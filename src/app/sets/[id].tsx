import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CardTile, cardGridStyles } from '@/components/card-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen';
import { useSet } from '@/hooks/use-cards';
import { useCollection } from '@/hooks/use-collection';
import { filterSetCards, ownedCardIds, progressOf, type SetFilter } from '@/services/set-progress.model';
import { colors, radius, space, type } from '@/theme/tokens';
import { setLogoUrl } from '@/services/tcgdex.service';
import type { CardBrief } from '@/types/card';

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const FILTERS: { id: SetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'missing', label: 'Missing' },
];

export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const set = useSet(typeof id === 'string' ? id : undefined);
  const collection = useCollection();
  const [filter, setFilter] = useState<SetFilter>('all');
  const owned = useMemo(() => (collection.data ? ownedCardIds(collection.data) : new Set<string>()), [collection.data]);
  const cards = set.data?.cards;
  const shown = useMemo(() => filterSetCards(cards ?? [], owned, filter), [cards, owned, filter]);

  if (set.isLoading) {
    return (
      <View style={styles.center}>
        <LoadingState label="Loading set…" />
      </View>
    );
  }

  if (set.isError || !set.data) {
    return (
      <View style={styles.center}>
        <ErrorState title="Could not load this set" error={set.error} subject="this set" onRetry={() => set.refetch()} />
      </View>
    );
  }

  const data = set.data;
  const { official, total } = data.cardCount;
  const count = !official
    ? total
      ? `${total} cards`
      : undefined
    : `${official} cards${total > official ? ` + ${total - official} secret` : ''}`;
  const meta = [data.serie?.name, formatDate(data.releaseDate), count].filter(Boolean);
  const progress = progressOf(data.cards.filter((c) => owned.has(c.id)).length, data.cards.length);

  return (
    <>
      <Stack.Screen options={{ title: data.name }} />
      <FlatList
        style={styles.screen}
        data={shown}
        keyExtractor={(c: CardBrief) => c.id}
        renderItem={({ item }) => <CardTile card={item} dim={owned.size > 0 && !owned.has(item.id)} />}
        numColumns={2}
        columnWrapperStyle={cardGridStyles.column}
        contentContainerStyle={cardGridStyles.list}
        initialNumToRender={8}
        ListHeaderComponent={
          <View style={styles.header}>
            {data.logo ? (
              <Image source={{ uri: setLogoUrl(data.logo) }} style={styles.logo} contentFit="contain" />
            ) : null}
            <Text style={styles.name} accessibilityRole="header">
              {data.name}
            </Text>
            <Text style={styles.meta}>{meta.join(' • ')}</Text>
            <View
              style={styles.progressBox}
              accessible
              accessibilityLabel={`You own ${progress.owned} of ${progress.total} cards, ${progress.pct} percent`}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress.pct}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {progress.owned} of {progress.total} owned · {progress.pct}%
              </Text>
            </View>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {FILTERS.map((f) => {
                const on = f.id === filter;
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setFilter(f.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          filter === 'all' ? (
            <EmptyState title="No cards listed" body="The catalog has no cards for this set yet." />
          ) : (
            <EmptyState
              title={filter === 'owned' ? 'None owned yet' : 'Nothing missing'}
              body={filter === 'owned' ? 'Cards you add from this set appear here.' : 'You own every card in this set.'}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.bg },
  muted: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
  retry: { backgroundColor: colors.gold400, borderRadius: radius.card, paddingHorizontal: space.xl, minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: colors.textOnGold },
  header: { alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.lg },
  logo: { width: 220, height: 80 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  meta: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  progressBox: { alignSelf: 'stretch', gap: 6, marginTop: space.sm },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold400 },
  progressText: { ...type.cardMeta, color: colors.textSecondary, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  chip: {
    minHeight: 38,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.textOnGold },
});

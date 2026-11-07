import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CardTile, cardGridStyles } from '@/components/card-tile';
import { EmptyState } from '@/components/screen';
import { useSet } from '@/hooks/use-cards';
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

export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const set = useSet(typeof id === 'string' ? id : undefined);

  if (set.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.goldText} />
      </View>
    );
  }

  if (set.isError || !set.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load this set. Check your connection.</Text>
        <Pressable style={styles.retry} onPress={() => set.refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
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

  return (
    <>
      <Stack.Screen options={{ title: data.name }} />
      <FlatList
        style={styles.screen}
        data={data.cards}
        keyExtractor={(c: CardBrief) => c.id}
        renderItem={({ item }) => <CardTile card={item} />}
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
          </View>
        }
        ListEmptyComponent={<EmptyState title="No cards listed" body="The catalog has no cards for this set yet." />}
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
});

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/icons';
import { EmptyState } from '@/components/screen';
import { useSets } from '@/hooks/use-cards';
import { useCollection } from '@/hooks/use-collection';
import { ownedPerSet, progressOf } from '@/services/set-progress.model';
import { setLogoUrl } from '@/services/tcgdex.service';
import { normalize } from '@/utils/text';
import { colors, radius, space, type } from '@/theme/tokens';
import type { SetBrief } from '@/types/card';

export default function SetsScreen() {
  const router = useRouter();
  const sets = useSets();
  const [filter, setFilter] = useState('');
  const collection = useCollection();
  const ownedIn = useMemo(() => (collection.data ? ownedPerSet(collection.data) : {}), [collection.data]);

  const shown = useMemo(() => {
    const all = sets.data ?? [];
    const f = normalize(filter);
    return f ? all.filter((s) => normalize(s.name).includes(f) || s.id.toLowerCase().includes(f)) : all;
  }, [sets.data, filter]);

  const renderSet = ({ item }: { item: SetBrief }) => {
    // Promo sets have no printed total, so fall back to how many cards exist.
    const count = item.cardCount.official || item.cardCount.total;
    const have = ownedIn[item.id] ?? 0;
    const countText = count
      ? have > 0
        ? `${have} of ${count} owned · ${progressOf(have, count).pct}%`
        : `${count} cards`
      : 'Card count not listed';
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => router.push({ pathname: '/sets/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${countText}`}>
        <View style={styles.logoBox}>
          {item.logo ? (
            <Image source={{ uri: setLogoUrl(item.logo) }} style={styles.logo} contentFit="contain" />
          ) : (
            <Text style={styles.logoFallback}>{item.id.toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.meta}>{countText}</Text>
        </View>
        <Icon name="chevron" color={colors.textTertiary} size={18} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filterWrap}>
        <Icon name="search" color={colors.textTertiary} size={18} />
        <TextInput
          style={styles.input}
          placeholder="Filter sets, e.g. Base or 151"
          placeholderTextColor={colors.textTertiary}
          value={filter}
          onChangeText={setFilter}
          autoCorrect={false}
          accessibilityLabel="Filter sets"
        />
      </View>
      {sets.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.goldText} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(s) => s.id}
          renderItem={renderSet}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          ListEmptyComponent={
            sets.isError ? (
              <EmptyState title="Could not load sets" body="Check your connection and try again." />
            ) : (
              <EmptyState title="No sets match" body={`Nothing matches “${filter}”.`} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  filterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
    margin: space.lg,
    marginBottom: space.md,
    paddingHorizontal: space.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary, height: '100%' },
  loading: { marginTop: space.xl * 2 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoBox: { width: 84, height: 40, alignItems: 'center', justifyContent: 'center' },
  logo: { width: '100%', height: '100%' },
  logoFallback: { ...type.caption, color: colors.textTertiary },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});

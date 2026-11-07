import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { EmptyState, ScreenTitle } from '@/components/screen';
import { useCardSearch } from '@/hooks/use-cards';
import { parseCollectorNumber } from '@/services/card-matcher.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { CardBrief } from '@/types/card';

export default function SearchScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const results = useCardSearch(query);

  const submit = () => {
    const value = text.trim();
    // "4/102" or "SWSH284" goes through the matcher, which needs a number.
    const number = /\d/.test(value) ? parseCollectorNumber(value) : null;
    if (number) {
      router.push({
        pathname: '/confirm',
        params: { number: number.localId, total: number.setTotal ? String(number.setTotal) : '' },
      });
      return;
    }
    setQuery(value);
  };

  const renderCard = ({ item }: { item: CardBrief }) => (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/result', params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, number ${item.localId}`}>
      {item.image ? (
        <Image
          source={{ uri: cardImageUrl(item.image, 'low') }}
          style={styles.art}
          contentFit="contain"
        />
      ) : (
        <View style={[styles.art, styles.artEmpty]}>
          <Text style={styles.artEmptyText}>No image</Text>
        </View>
      )}
      <Text style={styles.tileName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.tileMeta} numberOfLines={1}>
        #{item.localId}
      </Text>
    </Pressable>
  );

  const showHint = query.length < 3;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <ScreenTitle>Search</ScreenTitle>
        <View style={styles.searchRow}>
          <Pressable
            style={({ pressed }) => [styles.camera, pressed && styles.pressed]}
            onPress={() => router.push('/scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a card instead">
            <Icon name="camera" color={colors.textPrimary} size={24} />
          </Pressable>
          <View style={styles.inputWrap}>
            <Icon name="search" color={colors.textTertiary} size={18} />
            <TextInput
              style={styles.input}
              placeholder="Card name or number, e.g. 4/102"
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={submit}
              returnKeyType="search"
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel="Search cards"
            />
          </View>
        </View>
      </View>

      {results.isFetching ? (
        <ActivityIndicator style={styles.loading} color={colors.goldText} />
      ) : (
        <FlatList
          data={showHint ? [] : results.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            showHint ? (
              <EmptyState
                title="Find any card"
                body="Type at least 3 letters of a name and press search, or a number like 4/102."
              />
            ) : results.isError ? (
              <EmptyState title="Search failed" body="Check your connection and try again." />
            ) : (
              <EmptyState title="No cards found" body={`Nothing matches “${query}”. Check the spelling.`} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  camera: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary, height: '100%' },
  loading: { marginTop: space.xl * 2 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  column: { gap: space.md },
  tile: {
    flex: 1,
    maxWidth: '50%',
    padding: space.sm + 2,
    gap: 4,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  art: { width: '100%', aspectRatio: 63 / 88, borderRadius: 6, marginBottom: 4 },
  artEmpty: { backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  artEmptyText: { ...type.caption, color: colors.textTertiary },
  tileName: { ...type.cardTitle, color: colors.textPrimary },
  tileMeta: { ...type.cardMeta, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});

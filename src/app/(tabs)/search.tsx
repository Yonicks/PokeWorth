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

import { CardTile, cardGridStyles } from '@/components/card-tile';
import { Icon } from '@/components/icons';
import { EmptyState, ScreenTitle } from '@/components/screen';
import { useCardSearch } from '@/hooks/use-cards';
import { parseCollectorNumber } from '@/services/card-matcher.service';
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

  const renderCard = ({ item }: { item: CardBrief }) => <CardTile card={item} />;

  const showHint = query.length < 3;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <ScreenTitle
          right={
            <Pressable
              style={({ pressed }) => [styles.setsButton, pressed && styles.pressed]}
              onPress={() => router.push('/sets')}
              accessibilityRole="button">
              <Text style={styles.setsText}>Show Sets</Text>
            </Pressable>
          }>
          Search
        </ScreenTitle>
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
          columnWrapperStyle={cardGridStyles.column}
          contentContainerStyle={cardGridStyles.list}
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
  setsButton: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  setsText: { ...type.caption, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  pressed: { opacity: 0.85 },
});

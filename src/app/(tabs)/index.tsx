import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { EmptyState, SectionTitle } from '@/components/screen';
import { useRecentScans } from '@/hooks/use-cards';
import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { RecentScan } from '@/types/card';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recentScans = useRecentScans();

  useFocusEffect(
    useCallback(() => {
      recentScans.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const renderScan = ({ item }: { item: RecentScan }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/result', params: { id: item.cardId } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.setName ?? 'unknown set'}`}>
      {item.image ? (
        <Image source={{ uri: cardImageUrl(item.image, 'low') }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[item.setName, item.localId].filter(Boolean).join(' • ') || 'Unknown set'}
        </Text>
      </View>
      <Icon name="chevron" color={colors.textTertiary} size={18} />
    </Pressable>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      data={recentScans.data ?? []}
      keyExtractor={(item) => item.cardId}
      renderItem={renderScan}
      ItemSeparatorComponent={() => <View style={{ height: space.sm + 2 }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.wordmark} accessibilityRole="header">
            Poke<Text style={styles.wordmarkGold}>Worth</Text>
          </Text>
          <Text style={styles.tagline}>Scan a card to see what it’s worth.</Text>

          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={() => router.push('/scan')}
            accessibilityRole="button">
            <Icon name="camera" color={colors.textOnGold} size={26} />
            <Text style={styles.ctaText}>Scan Card</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => router.navigate('/search')}
            accessibilityRole="button">
            <Icon name="search" color={colors.textPrimary} size={20} />
            <Text style={styles.secondaryText}>Search Manually</Text>
          </Pressable>

          <SectionTitle>Recent Scans</SectionTitle>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No scans yet"
          body="Cards you scan or open from Search show up here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  wordmark: { ...type.wordmark, color: colors.textPrimary },
  wordmarkGold: { color: colors.goldText },
  tagline: { ...type.body, color: colors.textSecondary, marginTop: -space.sm },
  cta: {
    marginTop: space.sm,
    flexDirection: 'row',
    gap: space.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    borderRadius: radius.cta,
    backgroundColor: colors.gold400,
    borderWidth: 1,
    borderColor: colors.gold300,
    boxShadow: `0 0 16px ${colors.gold400}73`,
  },
  ctaText: { ...type.button, color: colors.textOnGold },
  secondary: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.card,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { fontSize: 17, fontWeight: '500', color: colors.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 9,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 50, height: 70, borderRadius: radius.thumb },
  thumbEmpty: { backgroundColor: colors.raised },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { ...type.cardTitle, fontSize: 17, color: colors.textPrimary },
  rowMeta: { ...type.cardMeta, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});

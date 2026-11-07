/** One card in a 2-column grid (Search results, set pages). */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { CardBrief } from '@/types/card';

export const CardTile = memo(function CardTile({ card }: { card: CardBrief }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/result', params: { id: card.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, number ${card.localId}`}>
      {card.image ? (
        <Image
          source={{ uri: cardImageUrl(card.image, 'low') }}
          style={styles.art}
          contentFit="contain"
          transition={120}
        />
      ) : (
        <View style={[styles.art, styles.artEmpty]}>
          <Text style={styles.artEmptyText}>No image</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>
        {card.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        #{card.localId}
      </Text>
    </Pressable>
  );
});

/** Shared FlatList props for a 2-column card grid. */
export const cardGridStyles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  column: { gap: space.md },
});

const styles = StyleSheet.create({
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
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});

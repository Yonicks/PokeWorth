/** One card in a 2-column grid (Search results, set pages), with quick add. */
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icons';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import { addOne, cardQuantity } from '@/services/collection.model';
import { entryInputFor } from '@/services/collection.service';
import { defaultPrinting, printingsFor } from '@/services/printings.service';
import { cardImageUrl, getCard } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { CardBrief } from '@/types/card';

/** + button: adds one copy of the card's main printing to the active portfolio. */
function QuickAdd({ card }: { card: CardBrief }) {
  const client = useQueryClient();
  const collection = useCollection();
  const update = useUpdateCollection();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const owned = collection.data ? cardQuantity(collection.data, card.id) : 0;

  const add = async () => {
    setBusy(true);
    setFailed(false);
    try {
      // Same cache key as useCard, so opening the card afterwards is instant.
      const full = await client.fetchQuery({
        queryKey: ['card', card.id],
        queryFn: () => getCard(card.id),
        staleTime: 1000 * 60 * 10,
      });
      const printing = defaultPrinting(printingsFor(full));
      if (!printing) throw new Error('No printing');
      await update.mutateAsync((s) => addOne(s, entryInputFor(full, printing)));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.addRow}>
      <Text style={styles.owned}>{failed ? 'Could not add' : owned > 0 ? `Qty: ${owned}` : 'Qty: 0'}</Text>
      <Pressable
        onPress={add}
        disabled={busy}
        hitSlop={6}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Add one ${card.name} to your portfolio`}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.goldText} />
        ) : (
          <Icon name="plus" color={colors.goldText} size={20} />
        )}
      </Pressable>
    </View>
  );
}

export const CardTile = memo(function CardTile({ card, dim = false }: { card: CardBrief; dim?: boolean }) {
  const router = useRouter();
  return (
    <View style={[styles.tile, dim && styles.dim]}>
      <Pressable
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
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
      <QuickAdd card={card} />
    </View>
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
    gap: space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dim: { opacity: 0.55 },
  open: { gap: 4 },
  art: { width: '100%', aspectRatio: 63 / 88, borderRadius: 6, marginBottom: 4 },
  artEmpty: { backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  artEmptyText: { ...type.caption, color: colors.textTertiary },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, color: colors.textSecondary },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  owned: { ...type.caption, color: colors.textTertiary },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.gold400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});

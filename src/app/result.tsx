import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardHero, Facts, PriceBlock, PrintingPicker } from '@/components/card-detail';
import { Icon } from '@/components/icons';
import { useCard } from '@/hooks/use-cards';
import { defaultPrinting, getPrintings, type Printing } from '@/services/printings.service';
import { addRecentScan } from '@/services/storage.service';
import { extractDisplayPrices } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { Card } from '@/types/card';

/** eBay's sold-items search for this card; opens in the in-app browser. */
function soldListingsUrl(card: Card): string {
  const number = card.set?.cardCount?.official
    ? `${card.localId}/${card.set.cardCount.official}`
    : card.localId;
  const query = [card.name, number, card.set?.name].filter(Boolean).join(' ');
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

function stageLabel(stage?: string): string | undefined {
  return stage?.replace(/^Stage(\d)$/, 'Stage $1');
}

/**
 * Cards without `variants_detailed` still get their prices: one printing
 * per provider row from the older flat pricing fields.
 */
function fallbackPrintings(card: Card): Printing[] {
  return extractDisplayPrices(card).map((p) => ({
    id: `${p.provider}-${p.variant}`,
    label: p.label,
    prices: [{ provider: p.provider, amount: p.amount, currency: p.currency, updated: p.updated }],
  }));
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCard(typeof id === 'string' ? id : undefined);
  const [selectedId, setSelectedId] = useState<string>();

  // Record in local history once the card is loaded.
  useEffect(() => {
    if (card.data) {
      addRecentScan({
        cardId: card.data.id,
        name: card.data.name,
        setName: card.data.set?.name,
        localId: card.data.localId,
        image: card.data.image,
        scannedAt: new Date().toISOString(),
      });
    }
  }, [card.data]);

  const printings = useMemo(() => {
    if (!card.data) return [];
    const detailed = getPrintings(card.data);
    return detailed.length > 0 ? detailed : fallbackPrintings(card.data);
  }, [card.data]);

  if (card.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.goldText} />
      </View>
    );
  }

  if (card.isError || !card.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load this card. Check your connection.</Text>
        <Pressable style={styles.retry} onPress={() => card.refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const data = card.data;
  const selected = printings.find((p) => p.id === selectedId) ?? defaultPrinting(printings);
  const official = data.set?.cardCount?.official;
  const number = official ? `${data.localId}/${official}` : data.localId;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CardHero image={data.image} name={data.name} />

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Text style={styles.name} accessibilityRole="header">
            {data.name}
          </Text>
          <Text style={styles.meta}>
            Pokémon • <Text style={styles.set}>{data.set?.name ?? 'Unknown set'}</Text>
          </Text>
          <Text style={styles.meta}>{[data.rarity, `№${number}`].filter(Boolean).join(' • ')}</Text>
        </View>

        <PrintingPicker printings={printings} selectedId={selected?.id} onSelect={setSelectedId} />
        <PriceBlock printing={selected} />

        <Pressable
          style={({ pressed }) => [styles.sold, pressed && styles.pressed]}
          onPress={() => WebBrowser.openBrowserAsync(soldListingsUrl(data))}
          accessibilityRole="link"
          accessibilityHint="Opens eBay sold listings in the browser">
          <Text style={styles.soldText}>View Sold Listings on eBay</Text>
          <Icon name="chevron" color={colors.goldText} size={18} />
        </Pressable>

        <Text style={styles.section} accessibilityRole="header">
          Card details
        </Text>
        <Facts
          rows={[
            ['HP', data.hp ? String(data.hp) : undefined],
            ['Type', data.types?.join(', ')],
            ['Stage', stageLabel(data.stage)],
            ['Rarity', data.rarity],
            ['Illustrator', data.illustrator],
            ['Set', data.set?.name],
            ['Number', number],
          ]}
        />

        <Text style={styles.disclaimer}>
          Prices are market estimates, not guaranteed resale values. Actual value depends on
          condition, printing, language and demand.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.bg },
  muted: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
  retry: { backgroundColor: colors.gold400, borderRadius: radius.card, paddingHorizontal: space.xl, minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: colors.textOnGold },
  body: { paddingHorizontal: space.lg, gap: space.lg, marginTop: -space.sm },
  titleBlock: { gap: 2 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 17, lineHeight: 23, color: colors.textSecondary },
  set: { color: colors.goldText },
  sold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.gold400,
  },
  soldText: { fontSize: 16, fontWeight: '700', color: colors.goldText },
  section: { ...type.section, color: colors.textPrimary, marginTop: space.sm },
  disclaimer: { fontSize: 13, lineHeight: 18, color: colors.textTertiary },
  pressed: { opacity: 0.85 },
});

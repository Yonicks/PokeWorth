import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddToPortfolio } from '@/components/add-to-portfolio';
import { CardHero, Facts, PriceBlock, PrintingPicker } from '@/components/card-detail';
import { Icon } from '@/components/icons';
import { PriceChart } from '@/components/price-chart';
import { useCard } from '@/hooks/use-cards';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import { useHistory, useRecordCard } from '@/hooks/use-history';
import { toggleFavorite } from '@/services/collection.model';
import { seriesKey } from '@/services/history.model';
import { soldListingsUrl } from '@/services/links';
import { defaultPrinting, printingsFor } from '@/services/printings.service';
import { addRecentScan } from '@/services/storage.service';
import { colors, radius, space, type } from '@/theme/tokens';

function stageLabel(stage?: string): string | undefined {
  return stage?.replace(/^Stage(\d)$/, 'Stage $1');
}

function FavoriteStar({ cardId, name }: { cardId: string; name: string }) {
  const collection = useCollection();
  const update = useUpdateCollection();
  const on = !!collection.data?.favorites.includes(cardId);
  return (
    <Pressable
      onPress={() => update.mutate((s) => toggleFavorite(s, cardId))}
      hitSlop={8}
      style={styles.star}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Remove ${name} from favourites` : `Add ${name} to favourites`}>
      <Icon name="star" color={on ? colors.goldText : colors.textTertiary} filled={on} size={26} />
    </Pressable>
  );
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  const printings = useMemo(() => (card.data ? printingsFor(card.data) : []), [card.data]);
  useRecordCard(card.data);
  const history = useHistory();

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
  const series = selected ? (history.data?.cards[seriesKey(data.id, selected.id)] ?? []) : [];
  const seriesCurrency = series[series.length - 1]?.c ?? selected?.prices[0]?.currency ?? 'USD';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CardHero image={data.image} name={data.name} />

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name} accessibilityRole="header">
              {data.name}
            </Text>
            <FavoriteStar cardId={data.id} name={data.name} />
          </View>
          <Text style={styles.meta}>
            Pokémon •{' '}
            {data.set ? (
              <Text
                style={styles.set}
                onPress={() => router.push({ pathname: '/sets/[id]', params: { id: data.set!.id } })}
                accessibilityRole="link"
                accessibilityHint="Opens every card in this set">
                {data.set.name}
              </Text>
            ) : (
              'Unknown set'
            )}
          </Text>
          <Text style={styles.meta}>{[data.rarity, `№${number}`].filter(Boolean).join(' • ')}</Text>
        </View>

        <PrintingPicker printings={printings} selectedId={selected?.id} onSelect={setSelectedId} />
        <PriceBlock printing={selected} />
        {selected && selected.prices.length > 0 ? (
          <PriceChart
            points={series}
            currency={seriesCurrency}
            title={`${selected.prices[0].provider} price history`}
            emptyText="No price recorded yet for this printing."
          />
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.sold, pressed && styles.pressed]}
          onPress={() => WebBrowser.openBrowserAsync(soldListingsUrl(data))}
          accessibilityRole="link"
          accessibilityHint="Opens eBay sold listings in the browser">
          <Text style={styles.soldText}>View Sold Listings on eBay</Text>
          <Icon name="chevron" color={colors.goldText} size={18} />
        </Pressable>

        <AddToPortfolio card={data} printings={printings} />

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
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  name: { flex: 1, fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.textPrimary },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -4 },
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

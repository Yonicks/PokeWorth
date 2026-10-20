import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCard } from '@/hooks/use-cards';
import { addRecentScan } from '@/services/storage.service';
import { cardImageUrl, extractDisplayPrices } from '@/services/tcgdex.service';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCard(typeof id === 'string' ? id : undefined);

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

  if (card.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (card.isError || !card.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load this card. Check your connection.</Text>
      </View>
    );
  }

  const data = card.data;
  const prices = extractDisplayPrices(data);
  const variants = Object.entries(data.variants ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {data.image && (
        <Image
          source={{ uri: cardImageUrl(data.image, 'high') }}
          style={styles.cardImage}
          resizeMode="contain"
        />
      )}

      <Text style={styles.name}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.set?.name ?? 'Unknown set'} · №{data.localId}
        {data.set?.cardCount?.official ? `/${data.set.cardCount.official}` : ''}
      </Text>
      {!!data.rarity && <Text style={styles.meta}>Rarity: {data.rarity}</Text>}
      {variants.length > 0 && (
        <Text style={styles.meta}>Printings: {variants.join(', ')}</Text>
      )}

      <Text style={styles.sectionTitle}>Market prices</Text>
      {prices.length === 0 ? (
        <View style={styles.noPriceBox}>
          <Text style={styles.noPriceText}>
            No market price data is available for this card right now.
          </Text>
        </View>
      ) : (
        prices.map((p) => (
          <View key={`${p.provider}-${p.variant}`} style={styles.priceRow}>
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>{p.label}</Text>
              <Text style={styles.priceSource}>
                {p.provider}
                {p.updated ? ` · updated ${p.updated.slice(0, 10)}` : ''}
              </Text>
            </View>
            <Text style={styles.priceAmount}>
              {p.amount.toFixed(2)} {p.currency}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.disclaimer}>
        Prices are market estimates, not guaranteed resale values. Actual value depends on
        condition, printing, language, and demand.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: '#8e8e93', fontSize: 15, textAlign: 'center' },
  cardImage: { width: '100%', aspectRatio: 63 / 88, borderRadius: 12, marginBottom: 16 },
  name: { fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 15, color: '#8e8e93', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  noPriceBox: {
    backgroundColor: 'rgba(142,142,147,0.12)',
    borderRadius: 10,
    padding: 16,
  },
  noPriceText: { color: '#8e8e93', fontSize: 15 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c7c7cc',
  },
  priceInfo: { flex: 1 },
  priceLabel: { fontSize: 16, fontWeight: '500' },
  priceSource: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  priceAmount: { fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 13, color: '#8e8e93', marginTop: 24, lineHeight: 18 },
});

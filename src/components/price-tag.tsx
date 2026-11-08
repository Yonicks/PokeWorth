/**
 * A card's price at a glance, for scan results and binder tiles. It loads the
 * card through the shared query cache (same key as the Card screen), so the
 * price shows as soon as the card is known and opening the card afterwards is instant.
 */
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { useCard } from '@/hooks/use-cards';
import { defaultPrinting, formatMoney, printingsFor } from '@/services/printings.service';
import { colors } from '@/theme/tokens';

/** Price text for one printing (the card's main printing when `printingId` is not given). */
export function useCardPrice(cardId?: string, printingId?: string) {
  const card = useCard(cardId);
  if (!cardId) return { state: 'none' as const };
  if (card.isLoading) return { state: 'loading' as const };
  if (!card.data) return { state: 'error' as const };
  const printings = printingsFor(card.data);
  const printing = printings.find((p) => p.id === printingId) ?? defaultPrinting(printings);
  const price = printing?.prices[0];
  if (!price) return { state: 'noprice' as const };
  return { state: 'ok' as const, text: formatMoney(price.amount, price.currency), provider: price.provider };
}

export function PriceTag({
  cardId,
  printingId,
  style,
}: {
  cardId?: string;
  printingId?: string;
  style?: StyleProp<TextStyle>;
}) {
  const p = useCardPrice(cardId, printingId);
  if (p.state === 'none') return null;
  const text = p.state === 'ok' ? p.text : p.state === 'loading' ? '…' : p.state === 'noprice' ? 'No price' : '—';
  return (
    <Text
      style={[styles.price, p.state !== 'ok' && styles.muted, style]}
      numberOfLines={1}
      accessibilityLabel={p.state === 'ok' ? `Worth ${p.text} on ${p.provider}` : text}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  price: { fontSize: 15, fontWeight: '800', color: colors.price, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textTertiary, fontWeight: '600' },
});

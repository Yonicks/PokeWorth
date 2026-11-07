/** "Adding to: Main" panel on Card Details: a stepper for each printing. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icons';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import { quantityOf, setQuantity } from '@/services/collection.model';
import { entryInputFor } from '@/services/collection.service';
import { formatMoney, type Printing } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { Card } from '@/types/card';

export function AddToPortfolio({ card, printings }: { card: Card; printings: Printing[] }) {
  const collection = useCollection();
  const update = useUpdateCollection();
  const state = collection.data;
  if (!state || printings.length === 0) return null;

  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  // Running total for this card, per currency.
  const sums: Record<string, number> = {};
  for (const p of printings) {
    const q = quantityOf(state, card.id, p.id);
    const price = p.prices[0];
    if (q > 0 && price) sums[price.currency] = (sums[price.currency] ?? 0) + q * price.amount;
  }
  const totalText = Object.entries(sums)
    .map(([c, v]) => formatMoney(v, c))
    .join(' + ');

  const change = (printing: Printing, qty: number) =>
    update.mutate((s) => setQuantity(s, entryInputFor(card, printing), qty));

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>
          Adding to: <Text style={styles.portfolio}>{portfolio?.name ?? 'Main'}</Text>
        </Text>
        {totalText ? <Text style={styles.total}>Total {totalText}</Text> : null}
      </View>

      {printings.map((p) => {
        const qty = quantityOf(state, card.id, p.id);
        const price = p.prices[0];
        return (
          <View key={p.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label} numberOfLines={2}>
                {p.label}
              </Text>
              <Text style={styles.price}>
                {price ? formatMoney(price.amount, price.currency) : 'No price'}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => change(p, qty - 1)}
                disabled={qty === 0}
                style={[styles.step, qty === 0 && styles.stepOff]}
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${p.label}`}>
                <Icon name="minus" color={qty === 0 ? colors.textTertiary : colors.goldText} size={20} />
              </Pressable>
              <Text style={styles.qty} accessibilityLabel={`${qty} owned`}>
                {qty}
              </Text>
              <Pressable
                onPress={() => change(p, qty + 1)}
                style={styles.step}
                accessibilityRole="button"
                accessibilityLabel={`Add one ${p.label}`}>
                <Icon name="plus" color={colors.goldText} size={20} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <Text style={styles.hint}>
        Graded copies (PSA, BGS, CGC) can be added in a later update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  title: { ...type.section, fontSize: 19, color: colors.textPrimary },
  portfolio: { color: colors.goldText },
  total: { fontSize: 15, fontWeight: '600', color: colors.price, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...type.cardTitle, color: colors.textPrimary },
  price: { ...type.cardMeta, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.gold400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { borderColor: colors.border },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textTertiary },
});

/** Home: portfolio total and the four most valuable cards. Hidden until you own cards. */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCollection } from '@/hooks/use-collection';
import { byValue, entriesIn, totals } from '@/services/collection.model';
import { formatMoney, formatTotals } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';

export function MostValuable() {
  const router = useRouter();
  const collection = useCollection();
  const state = collection.data;
  if (!state) return null;
  const entries = entriesIn(state);
  if (entries.length === 0) return null;

  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  const top = byValue(entries).slice(0, 4);
  const t = totals(entries);

  return (
    <View style={styles.box}>
      <Text style={styles.eyebrow}>Portfolio {portfolio?.name ?? 'Main'}</Text>
      <Text style={styles.total}>{formatTotals(t.byCurrency)}</Text>
      <Text style={styles.title} accessibilityRole="header">
        Most Valuable
      </Text>
      {top.map((e) => (
        <Pressable
          key={e.id}
          style={styles.row}
          onPress={() => router.push({ pathname: '/result', params: { id: e.cardId } })}
          accessibilityRole="button">
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {e.card.name}
              {e.quantity > 1 ? <Text style={styles.qty}> ×{e.quantity}</Text> : null}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {e.condition} • {e.printingLabel}
            </Text>
          </View>
          <Text style={styles.value}>
            {e.price ? formatMoney(e.price.amount * e.quantity, e.price.currency) : 'No price'}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={() => router.navigate('/portfolio')} style={styles.all} accessibilityRole="button">
        <Text style={styles.allText}>View All</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.lg,
    marginTop: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { ...type.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  total: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  title: { ...type.cardTitle, fontSize: 18, color: colors.textPrimary, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  qty: { color: colors.textTertiary, fontWeight: '500' },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  value: { ...type.price, fontSize: 17, color: colors.price },
  all: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  allText: { fontSize: 16, fontWeight: '600', color: colors.goldText },
});

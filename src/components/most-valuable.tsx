/**
 * Home overview: portfolio total in the display currency, its value over
 * time, market movers and the four most valuable cards. Hidden until you
 * own cards.
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceChart, type ChartPoint } from '@/components/price-chart';
import { TotalValue } from '@/components/total-value';
import { useCollection } from '@/hooks/use-collection';
import { useFxRate, useHistory, useSettings } from '@/hooks/use-history';
import { byValue, entriesIn, totals, type CollectionEntry } from '@/services/collection.model';
import { convertTotals, sortValue } from '@/services/currency.model';
import { formatChange, formatMoney } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';

/** Owned printings that moved most against their 30-day Cardmarket average. */
function movers(entries: CollectionEntry[]): CollectionEntry[] {
  return entries
    .filter((e) => e.price?.vs30d !== undefined && Math.abs(e.price.vs30d) >= 1)
    .sort((a, b) => Math.abs(b.price!.vs30d!) - Math.abs(a.price!.vs30d!))
    .slice(0, 4);
}

function Row({ entry, right, rightColor }: { entry: CollectionEntry; right: string; rightColor: string }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/result', params: { id: entry.cardId } })}
      accessibilityRole="button">
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.card.name}
          {entry.quantity > 1 ? <Text style={styles.qty}> ×{entry.quantity}</Text> : null}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {entry.condition} • {entry.printingLabel}
        </Text>
      </View>
      <Text style={[styles.value, { color: rightColor }]}>{right}</Text>
    </Pressable>
  );
}

export function MostValuable() {
  const router = useRouter();
  const collection = useCollection();
  const history = useHistory();
  const settings = useSettings();
  const fx = useFxRate();
  const state = collection.data;
  if (!state) return null;
  const entries = entriesIn(state);
  if (entries.length === 0) return null;

  const rate = fx.data ?? undefined;
  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  const top = byValue(entries, (a, c) => sortValue(a, c, rate)).slice(0, 4);
  const moving = movers(entries);
  const t = totals(entries);

  // Value over time in one currency, converted at today's rate (said in the note).
  const target = settings.data?.currency ?? 'USD';
  const chartCurrency = target === 'original' ? 'USD' : target;
  const points: ChartPoint[] = [];
  for (const p of history.data?.portfolios[state.activePortfolioId] ?? []) {
    const c = convertTotals(p.t, chartCurrency, rate);
    if (c.amount !== undefined && Object.keys(c.rest).length === 0) points.push({ d: p.d, v: c.amount });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        <Text style={styles.eyebrow}>Portfolio {portfolio?.name ?? 'Main'}</Text>
        <TotalValue byCurrency={t.byCurrency} style={styles.total} />
      </View>

      <PriceChart
        points={points}
        currency={chartCurrency}
        title="Portfolio value"
        emptyText="Your portfolio's value is recorded once a day from today."
      />

      {moving.length > 0 ? (
        <View style={styles.box}>
          <Text style={styles.title} accessibilityRole="header">
            Movers
          </Text>
          <Text style={styles.sub}>Today’s Cardmarket price against its 30-day average</Text>
          {moving.map((e) => (
            <Row
              key={e.id}
              entry={e}
              right={formatChange(e.price!.vs30d!)}
              rightColor={e.price!.vs30d! >= 0 ? colors.up : colors.down}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.box}>
        <Text style={styles.title} accessibilityRole="header">
          Most Valuable
        </Text>
        {top.map((e) => (
          <Row
            key={e.id}
            entry={e}
            right={e.price ? formatMoney(e.price.amount * e.quantity, e.price.currency) : 'No price'}
            rightColor={colors.price}
          />
        ))}
        <Pressable onPress={() => router.navigate('/portfolio')} style={styles.all} accessibilityRole="button">
          <Text style={styles.allText}>View All</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginTop: space.md },
  box: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { ...type.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  total: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  title: { ...type.cardTitle, fontSize: 18, color: colors.textPrimary },
  sub: { fontSize: 13, lineHeight: 17, color: colors.textTertiary, marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  qty: { color: colors.textTertiary, fontWeight: '500' },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  value: { ...type.price, fontSize: 17 },
  all: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  allText: { fontSize: 16, fontWeight: '600', color: colors.goldText },
});

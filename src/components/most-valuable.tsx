/**
 * Home overview: portfolio total in the display currency, its value over
 * time, market movers and the four most valuable cards. Hidden until you
 * own cards.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceChart, type ChartPoint } from '@/components/price-chart';
import { TotalValue } from '@/components/total-value';
import { useCollection } from '@/hooks/use-collection';
import { useFxRate, useHistory, useSettings } from '@/hooks/use-history';
import { byValue, entriesIn, totals, type CollectionEntry } from '@/services/collection.model';
import { convertTotals, sortValue } from '@/services/currency.model';
import { cardMovers, changeOver, type Change, type MoverDays } from '@/services/movers.model';
import { formatChange, formatMoney } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';

/** Owned printings that moved most against their 30-day Cardmarket average. */
function movers(entries: CollectionEntry[]): CollectionEntry[] {
  return entries
    .filter((e) => e.price?.vs30d !== undefined && Math.abs(e.price.vs30d) >= 1)
    .sort((a, b) => Math.abs(b.price!.vs30d!) - Math.abs(a.price!.vs30d!))
    .slice(0, 4);
}

function signed(amount: number, currency: string): string {
  return `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(amount), currency)}`;
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
  const [days, setDays] = useState<MoverDays>(7);
  const state = collection.data;
  if (!state) return null;
  const entries = entriesIn(state);
  if (entries.length === 0) return null;

  const rate = fx.data ?? undefined;
  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  const top = byValue(entries, (a, c) => sortValue(a, c, rate)).slice(0, 4);
  const moving = movers(entries);
  const t = totals(entries);
  const recorded = history.data ? cardMovers(history.data, entries, days) : { gainers: [], losers: [] };
  const recordedShown = [...recorded.gainers.slice(0, 3), ...recorded.losers.slice(0, 3)];

  // Value over time in one currency, converted at today's rate (said in the note).
  const target = settings.data?.currency ?? 'USD';
  const chartCurrency = target === 'original' ? 'USD' : target;
  const points: ChartPoint[] = [];
  for (const p of history.data?.portfolios[state.activePortfolioId] ?? []) {
    const c = convertTotals(p.t, chartCurrency, rate);
    if (c.amount !== undefined && Object.keys(c.rest).length === 0) points.push({ d: p.d, v: c.amount });
  }

  const week = changeOver(points.map((p) => ({ d: p.d, v: p.v })), 7);
  const month = changeOver(points.map((p) => ({ d: p.d, v: p.v })), 30);

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        <Text style={styles.eyebrow}>Portfolio {portfolio?.name ?? 'Main'}</Text>
        <TotalValue byCurrency={t.byCurrency} style={styles.total} />
        {week || month ? (
          <View style={styles.deltas}>
            {[
              ['this week', week],
              ['this month', month],
            ].map(([label, c]) =>
              c ? (
                <Text key={label as string} style={[styles.delta, { color: (c as Change).amount >= 0 ? colors.up : colors.down }]}>
                  {signed((c as Change).amount, chartCurrency)} ({formatChange((c as Change).pct)})
                  <Text style={styles.deltaLabel}> {label as string}</Text>
                </Text>
              ) : null,
            )}
          </View>
        ) : null}
      </View>

      <PriceChart
        points={points}
        currency={chartCurrency}
        title="Portfolio value"
        emptyText="Your portfolio's value is recorded once a day from today."
      />

      {recordedShown.length > 0 || moving.length > 0 ? (
        <View style={styles.box}>
          <View style={styles.moversHead}>
            <Text style={styles.title} accessibilityRole="header">
              Movers
            </Text>
            <View style={styles.toggle} accessibilityRole="radiogroup">
              {([7, 30] as MoverDays[]).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.toggleItem, d === days && styles.toggleOn]}
                  onPress={() => setDays(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: d === days }}>
                  <Text style={[styles.toggleText, d === days && styles.toggleTextOn]}>{d} days</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {recordedShown.length > 0 ? (
            <>
              <Text style={styles.sub}>Your recorded prices over the last {days} days</Text>
              {recordedShown.map((m) => (
                <Row
                  key={m.entry.id}
                  entry={m.entry}
                  right={formatChange(m.change.pct)}
                  rightColor={m.change.pct >= 0 ? colors.up : colors.down}
                />
              ))}
            </>
          ) : (
            <>
              <Text style={styles.sub}>
                Not enough recorded days yet for {days}-day changes. Today’s Cardmarket price against its 30-day average:
              </Text>
              {moving.map((e) => (
                <Row
                  key={e.id}
                  entry={e}
                  right={formatChange(e.price!.vs30d!)}
                  rightColor={e.price!.vs30d! >= 0 ? colors.up : colors.down}
                />
              ))}
            </>
          )}
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
  deltas: { gap: 2 },
  delta: { fontSize: 14, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  deltaLabel: { fontWeight: '400', color: colors.textTertiary },
  moversHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  toggle: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.pill, backgroundColor: colors.raised },
  toggleItem: { minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.gold400 },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTextOn: { color: colors.textOnGold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  qty: { color: colors.textTertiary, fontWeight: '500' },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  value: { ...type.price, fontSize: 17 },
  all: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  allText: { fontSize: 16, fontWeight: '600', color: colors.goldText },
});

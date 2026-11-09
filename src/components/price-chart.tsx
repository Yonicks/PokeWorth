/**
 * Line chart for recorded daily values (react-native-svg), with low/high
 * guides and 1M–MAX range pills. History is recorded on this device, so a new
 * card shows one point and says so rather than drawing anything invented.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { changeOf, inRange, RANGES, spanDays, type Range } from '@/services/history.model';
import { formatChange, formatMoney } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';

export interface ChartPoint {
  d: string;
  v: number;
}

const HEIGHT = 170;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

function shortDate(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PriceChart({
  points,
  currency,
  title,
  emptyText,
}: {
  points: ChartPoint[];
  currency: string;
  title: string;
  emptyText: string;
}) {
  const [range, setRange] = useState<Range>('1M');
  const [width, setWidth] = useState(0);
  const shown = inRange(points, range);
  const change = changeOf(shown);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  let chart = null;
  if (shown.length >= 2 && width > 0) {
    const vs = shown.map((p) => p.v);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const span = max - min || max * 0.05 || 1;
    const lo = min - span * 0.08;
    const hi = max + span * 0.08;
    const h = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const x = (i: number) => (i / (shown.length - 1)) * width;
    const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * h;
    const line = shown.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${width},${HEIGHT - PAD_BOTTOM} L0,${HEIGHT - PAD_BOTTOM} Z`;
    const last = shown[shown.length - 1];
    chart = (
      <>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.gold400} stopOpacity={0.28} />
              <Stop offset="1" stopColor={colors.gold400} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke={colors.textTertiary} strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
          <Line x1={0} x2={width} y1={y(min)} y2={y(min)} stroke={colors.textTertiary} strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
          <Path d={area} fill="url(#fill)" />
          <Path d={line} fill="none" stroke={colors.gold400} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(shown.length - 1)} cy={y(last.v)} r={4.5} fill={colors.gold400} stroke={colors.bg} strokeWidth={2} />
        </Svg>
        <Text style={[styles.guide, { top: y(max) - 18 }]}>{formatMoney(max, currency)}</Text>
        <Text style={[styles.guide, { top: y(min) + 3 }]}>{formatMoney(min, currency)}</Text>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{shortDate(shown[0].d)}</Text>
          <Text style={styles.axisText}>{shortDate(last.d)}</Text>
        </View>
      </>
    );
  }

  const days = spanDays(points);
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {change !== undefined ? (
          <Text style={[styles.change, { color: change >= 0 ? colors.up : colors.down }]}>
            {formatChange(change)} <Text style={styles.changeLabel}>{range === 'MAX' ? 'all time' : range}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.plot} onLayout={onLayout} accessibilityLabel={`${title}, ${shown.length} days recorded`}>
        {chart ?? (
          <View style={styles.empty}>
            {points.length === 1 ? (
              <Text style={styles.emptyValue}>{formatMoney(points[0].v, currency)}</Text>
            ) : null}
            <Text style={styles.emptyText}>
              {points.length === 0
                ? emptyText
                : shown.length < 2 && points.length >= 2
                  ? 'No change recorded in this range yet. Try MAX.'
                  : 'History starts today on this phone. The chart fills in one day at a time.'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.pills}>
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[styles.pill, r === range && styles.pillOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: r === range }}>
            <Text style={[styles.pillText, r === range && styles.pillTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>
        {points.length === 0
          ? 'Recorded on this phone, once a day.'
          : `Recorded on this phone · ${points.length} day${points.length === 1 ? '' : 's'}${days ? ` over ${days} days` : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  title: { ...type.cardTitle, fontSize: 18, color: colors.textPrimary },
  change: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeLabel: { fontSize: 13, fontWeight: '400', color: colors.textTertiary },
  plot: { height: HEIGHT, justifyContent: 'center' },
  guide: { position: 'absolute', left: 0, fontSize: 12, color: colors.textTertiary, fontVariant: ['tabular-nums'] },
  axis: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 12, color: colors.textTertiary },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  emptyValue: { ...type.price, fontSize: 22, color: colors.price },
  emptyText: { ...type.body, fontSize: 14, color: colors.textTertiary, textAlign: 'center' },
  pills: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  pill: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  pillText: { fontSize: 14, fontWeight: '700', color: colors.textTertiary },
  pillTextOn: { color: colors.textPrimary },
  note: { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
});

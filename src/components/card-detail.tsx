/** Building blocks of the Card detail screen (roadmap step 2). */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatChange,
  formatMoney,
  type Printing,
  type PrintingPrice,
} from '@/services/printings.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';

/** Large artwork on a blurred copy of itself; tap opens it full screen. */
export function CardHero({ image, name }: { image?: string; name: string }) {
  const insets = useSafeAreaInsets();
  const [full, setFull] = useState(false);
  const uri = cardImageUrl(image, 'high');

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 56 }]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
          <Pressable
            onPress={() => setFull(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${name} card image. Opens full screen`}>
            <Image source={{ uri }} style={styles.heroCard} contentFit="contain" transition={150} />
          </Pressable>
          <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
            <Pressable
              style={styles.fullBackdrop}
              onPress={() => setFull(false)}
              accessibilityRole="button"
              accessibilityLabel="Close full-screen image">
              <Image source={{ uri }} style={styles.fullImage} contentFit="contain" />
              <Text style={styles.fullHint}>Tap anywhere to close</Text>
            </Pressable>
          </Modal>
        </>
      ) : (
        <View style={[styles.heroCard, styles.heroEmpty]}>
          <Text style={styles.muted}>No image for this card</Text>
        </View>
      )}
    </View>
  );
}

/** Chips to choose a printing; hidden when the card has only one. */
export function PrintingPicker({
  printings,
  selectedId,
  onSelect,
}: {
  printings: Printing[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (printings.length < 2) return null;
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.label}>Printing</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {printings.map((p) => {
          const on = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Change({ label, pct }: { label: string; pct?: number }) {
  if (pct === undefined) return null;
  const color = pct > 0.05 ? colors.up : pct < -0.05 ? colors.down : colors.textTertiary;
  return (
    <Text style={styles.change}>
      <Text style={{ color }}>{formatChange(pct)}</Text>
      <Text style={styles.changeLabel}> {label}</Text>
    </Text>
  );
}

/** Cardmarket gives a trend price; TCGplayer a market price. */
function kindOf(p: PrintingPrice, capital = false): string {
  const kind = p.provider === 'Cardmarket' ? 'trend price' : 'market price';
  return capital ? kind.charAt(0).toUpperCase() + kind.slice(1) : kind;
}

function dateOf(updated?: string): string {
  return updated ? updated.slice(0, 10) : 'date unknown';
}

/** Main price for the chosen printing, then the other provider below it. */
export function PriceBlock({ printing }: { printing?: Printing }) {
  if (!printing || printing.prices.length === 0) {
    return (
      <View style={styles.noPrice}>
        <Text style={styles.noPriceTitle}>No price available</Text>
        <Text style={styles.muted}>
          Neither TCGplayer nor Cardmarket has market data for this printing right now.
        </Text>
      </View>
    );
  }
  const [main, ...others] = printing.prices;
  return (
    <View style={styles.priceCard}>
      <Text style={styles.label}>{printing.label}</Text>
      <Text style={styles.bigPrice} accessibilityLabel={`${formatMoney(main.amount, main.currency)} on ${main.provider}`}>
        {formatMoney(main.amount, main.currency)}
      </Text>
      <Text style={styles.source}>
        {main.provider} {kindOf(main)} · {main.currency} · {dateOf(main.updated)}
      </Text>
      <PriceExtras price={main} />
      {others.map((p) => (
        <View key={p.provider} style={styles.otherRow}>
          <View style={styles.otherText}>
            <Text style={styles.otherProvider}>{p.provider}</Text>
            <Text style={styles.source}>
              {kindOf(p, true)} · {p.currency} · {dateOf(p.updated)}
            </Text>
            <PriceExtras price={p} />
          </View>
          <Text style={styles.otherAmount}>{formatMoney(p.amount, p.currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function PriceExtras({ price }: { price: PrintingPrice }) {
  const hasChange = price.vs7d !== undefined || price.vs30d !== undefined;
  const hasRange = price.low !== undefined && price.high !== undefined;
  if (!hasChange && !hasRange) return null;
  return (
    <View style={styles.extras}>
      <Change label="vs 7-day avg" pct={price.vs7d} />
      <Change label="vs 30-day avg" pct={price.vs30d} />
      {hasRange && (
        <Text style={styles.changeLabel}>
          Listings {formatMoney(price.low as number, price.currency)}–
          {formatMoney(price.high as number, price.currency)}
        </Text>
      )}
    </View>
  );
}

/** Two-column facts list (HP, type, stage, illustrator, ...). */
export function Facts({ rows }: { rows: [string, string | undefined][] }) {
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  if (shown.length === 0) return null;
  return (
    <View style={styles.facts}>
      {shown.map(([k, v], i) => (
        <View key={k} style={[styles.factRow, i < shown.length - 1 && styles.factBorder]}>
          <Text style={styles.factKey}>{k}</Text>
          <Text style={styles.factValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: space.xl, overflow: 'hidden' },
  heroShade: { backgroundColor: 'rgba(3, 18, 41, 0.62)' },
  heroCard: {
    width: 230,
    aspectRatio: 63 / 88,
    borderRadius: 12,
    boxShadow: `0 0 28px ${colors.gold400}59`,
  },
  heroEmpty: { backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  fullBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  fullImage: { width: '100%', height: '80%' },
  fullHint: { ...type.caption, color: colors.textTertiary, marginTop: space.md },
  muted: { ...type.body, color: colors.textTertiary },
  label: { ...type.caption, color: colors.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' },
  pickerBlock: { gap: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md + 2,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.textOnGold },
  priceCard: {
    gap: 4,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigPrice: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.price, fontVariant: ['tabular-nums'] },
  source: { fontSize: 13, lineHeight: 17, color: colors.textTertiary },
  extras: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2, marginTop: 2 },
  change: { fontSize: 13, lineHeight: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  changeLabel: { fontSize: 13, lineHeight: 17, fontWeight: '400', color: colors.textTertiary },
  otherRow: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  otherText: { flex: 1, minWidth: 0, gap: 2 },
  otherProvider: { ...type.cardTitle, color: colors.textPrimary },
  otherAmount: { ...type.price, color: colors.price },
  noPrice: {
    gap: 4,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noPriceTitle: { ...type.cardTitle, color: colors.textPrimary },
  facts: {
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  factBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  factKey: { ...type.body, color: colors.textSecondary },
  factValue: { ...type.body, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
});

/**
 * "Adding to: Main" panel on Card Details: a stepper for each ungraded
 * printing, and the graded copies you entered (roadmap steps 4 and 6).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GradedForm } from '@/components/graded-form';
import { Icon } from '@/components/icons';
import { useTotalText } from '@/components/total-value';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import {
  gradedOf,
  quantityOf,
  removeEntries,
  setQuantity,
  type CollectionEntry,
} from '@/services/collection.model';
import { entryInputFor } from '@/services/collection.service';
import { formatMoney, type Printing } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { Card } from '@/types/card';

function GradedRow({ entry, onRemove }: { entry: CollectionEntry; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <Text style={styles.badgeCompany}>{entry.graded!.company}</Text>
        <Text style={styles.badgeGrade}>{entry.graded!.grade}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.label} numberOfLines={1}>
          {entry.printingLabel}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {[
            entry.graded!.cert ? `Cert ${entry.graded!.cert}` : undefined,
            entry.price ? `${formatMoney(entry.price.amount, entry.price.currency)} your value` : 'No value entered',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Pressable
        onPress={() => (confirm ? onRemove() : setConfirm(true))}
        style={[styles.remove, confirm && styles.removeConfirm]}
        accessibilityRole="button"
        accessibilityLabel={confirm ? 'Tap again to remove this graded copy' : `Remove ${entry.condition} copy`}>
        {confirm ? <Text style={styles.removeText}>Remove?</Text> : <Icon name="trash" color={colors.textTertiary} size={20} />}
      </Pressable>
    </View>
  );
}

export function AddToPortfolio({ card, printings }: { card: Card; printings: Printing[] }) {
  const collection = useCollection();
  const update = useUpdateCollection();
  const [form, setForm] = useState(false);
  const state = collection.data;

  // Running total for this card (raw at market price + graded at your value), per currency.
  const sums: Record<string, number> = {};
  const graded = state ? gradedOf(state, card.id) : [];
  if (state) {
    for (const p of printings) {
      const q = quantityOf(state, card.id, p.id);
      const price = p.prices[0];
      if (q > 0 && price) sums[price.currency] = (sums[price.currency] ?? 0) + q * price.amount;
    }
    for (const g of graded) {
      if (g.price) sums[g.price.currency] = (sums[g.price.currency] ?? 0) + g.price.amount;
    }
  }
  const total = useTotalText(sums);

  if (!state || printings.length === 0) return null;
  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  const owned = Object.keys(sums).length > 0;

  const change = (printing: Printing, qty: number) =>
    update.mutate((s) => setQuantity(s, entryInputFor(card, printing), qty));

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>
          Adding to: <Text style={styles.portfolio}>{portfolio?.name ?? 'Main'}</Text>
        </Text>
        {owned ? <Text style={styles.total}>Total {total.text}</Text> : null}
      </View>

      <Text style={styles.section}>Ungraded</Text>
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

      <Text style={styles.section}>Graded</Text>
      {graded.length === 0 ? (
        <Text style={styles.hint}>No graded copies yet. Add a PSA, BGS, CGC or other slab.</Text>
      ) : (
        graded.map((g) => (
          <GradedRow key={g.id} entry={g} onRemove={() => update.mutate((s) => removeEntries(s, [g.id]))} />
        ))
      )}
      <Pressable style={styles.addGraded} onPress={() => setForm(true)} accessibilityRole="button">
        <Icon name="plus" color={colors.goldText} size={18} />
        <Text style={styles.addGradedText}>Add a graded card</Text>
      </Pressable>

      {total.rateNote && owned ? <Text style={styles.hint}>{total.rateNote}</Text> : null}

      <GradedForm card={card} printings={printings} visible={form} onClose={() => setForm(false)} />
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
  section: { ...type.cardTitle, fontSize: 17, color: colors.textPrimary, marginTop: space.xs },
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
  badge: {
    width: 52,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.gold400,
  },
  badgeCompany: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.4 },
  badgeGrade: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.goldText },
  remove: { minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  removeConfirm: { paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.down },
  removeText: { fontSize: 14, fontWeight: '700', color: colors.down },
  addGraded: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold400,
  },
  addGradedText: { fontSize: 16, fontWeight: '600', color: colors.goldText },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textTertiary },
});

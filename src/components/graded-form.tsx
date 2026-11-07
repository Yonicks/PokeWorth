/** Sheet to add a graded copy: printing, grader, grade, cert and your own value. */
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import {
  addGraded,
  GRADES,
  GRADING_COMPANIES,
  validateGraded,
  type GradedErrors,
  type GradedInput,
} from '@/services/collection.model';
import { entryInputFor } from '@/services/collection.service';
import { soldListingsUrl } from '@/services/links';
import type { Printing } from '@/services/printings.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { Card } from '@/types/card';

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T | '';
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GradedForm({
  card,
  printings,
  visible,
  onClose,
}: {
  card: Card;
  printings: Printing[];
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const collection = useCollection();
  const update = useUpdateCollection();
  const [printingId, setPrintingId] = useState(printings[0]?.id ?? '');
  const [company, setCompany] = useState<string>('PSA');
  const [grade, setGrade] = useState<string>('');
  const [cert, setCert] = useState('');
  const [valueText, setValueText] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [errors, setErrors] = useState<GradedErrors>({});

  const printing = printings.find((p) => p.id === printingId) ?? printings[0];
  if (!printing || !collection.data) return null;

  const reset = () => {
    setGrade('');
    setCert('');
    setValueText('');
    setErrors({});
  };

  const save = () => {
    const base = entryInputFor(card, printing);
    const amount = Number(valueText.replace(',', '.'));
    const input: GradedInput = {
      cardId: base.cardId,
      printingId: base.printingId,
      printingLabel: base.printingLabel,
      card: base.card,
      company,
      grade,
      cert: cert.trim() || undefined,
      value: valueText.trim() ? { amount, currency } : undefined,
    };
    const found = validateGraded(collection.data!, input, valueText);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate((s) => addGraded(s, input));
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              Add a graded {card.name}
            </Text>

            {printings.length > 1 ? (
              <>
                <Text style={styles.label}>Printing</Text>
                <Chips
                  label="Printing"
                  options={printings.map((p) => p.label)}
                  value={printing.label}
                  onChange={(l) => setPrintingId(printings.find((p) => p.label === l)?.id ?? printing.id)}
                />
              </>
            ) : null}

            <Text style={styles.label}>Graded by</Text>
            <Chips label="Graded by" options={GRADING_COMPANIES} value={company as (typeof GRADING_COMPANIES)[number]} onChange={setCompany} />
            {errors.company ? <Text style={styles.error}>{errors.company}</Text> : null}

            <Text style={styles.label}>Grade</Text>
            <Chips label="Grade" options={GRADES} value={grade as (typeof GRADES)[number]} onChange={setGrade} />
            {errors.grade ? <Text style={styles.error}>{errors.grade}</Text> : null}
            {grade ? (
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(soldListingsUrl(card, `${company} ${grade}`))}
                accessibilityRole="link"
                style={styles.link}>
                <Text style={styles.linkText}>
                  See sold {company} {grade} copies on eBay
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.label}>Certificate number (optional)</Text>
            <TextInput
              style={[styles.input, errors.cert && styles.inputError]}
              value={cert}
              onChangeText={setCert}
              placeholder="From the slab label, e.g. 12345678"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              accessibilityLabel="Certificate number"
            />
            {errors.cert ? <Text style={styles.error}>{errors.cert}</Text> : null}

            <Text style={styles.label}>Your value (optional)</Text>
            <View style={styles.valueRow}>
              <TextInput
                style={[styles.input, styles.valueInput, errors.value && styles.inputError]}
                value={valueText}
                onChangeText={setValueText}
                placeholder="What you paid or would sell for"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                accessibilityLabel="Your value"
              />
              <Chips label="Currency" options={['USD', 'EUR'] as const} value={currency} onChange={setCurrency} />
            </View>
            {errors.value ? <Text style={styles.error}>{errors.value}</Text> : null}
            <Text style={styles.hint}>
              PokeWorth has no free source for graded prices, so the portfolio counts the value you
              enter here. Leave it empty and the copy is listed without a price.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancel]}
              onPress={() => {
                reset();
                onClose();
              }}
              accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.save]} onPress={save} accessibilityRole="button">
              <Text style={styles.saveText}>Add graded card</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.bgBottom,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { padding: space.lg, gap: space.sm },
  title: { ...type.section, color: colors.textPrimary, marginBottom: space.sm },
  label: { ...type.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.textOnGold },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
  },
  inputError: { borderColor: colors.down },
  valueRow: { gap: space.sm },
  valueInput: { flex: 1 },
  error: { fontSize: 13, color: colors.down },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textTertiary, marginTop: space.sm },
  link: { minHeight: 36, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.goldText },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  button: { flex: 1, minHeight: 50, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  save: { backgroundColor: colors.gold400 },
  saveText: { fontSize: 16, fontWeight: '700', color: colors.textOnGold },
});

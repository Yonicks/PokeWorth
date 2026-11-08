import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackupSection } from '@/components/backup-section';
import { ScreenTitle, SectionTitle } from '@/components/screen';
import { useFxRate, useSetCurrency, useSettings } from '@/hooks/use-history';
import type { DisplayCurrency } from '@/services/currency.model';
import { colors, radius, space, type } from '@/theme/tokens';

const CURRENCIES: { id: DisplayCurrency; label: string; hint: string }[] = [
  { id: 'USD', label: 'USD $', hint: 'Totals in US dollars' },
  { id: 'EUR', label: 'EUR €', hint: 'Totals in euros' },
  { id: 'original', label: 'Original', hint: 'Each currency separately, no conversion' },
];

/** Profile tab: settings and app info. */
export default function ProfileScreen() {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const settings = useSettings();
  const setCurrency = useSetCurrency();
  const fx = useFxRate();
  const current = settings.data?.currency ?? 'USD';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle>Profile</ScreenTitle>

      <SectionTitle>Currency for totals</SectionTitle>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {CURRENCIES.map((c) => {
          const on = c.id === current;
          return (
            <Pressable
              key={c.id}
              style={[styles.segmentItem, on && styles.segmentOn]}
              onPress={() => setCurrency.mutate(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityHint={c.hint}>
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>
        Card prices always show the currency their source uses (TCGplayer in USD, Cardmarket in
        EUR). Portfolio totals are converted with the European Central Bank rate
        {fx.data ? `: €1 = $${fx.data.eurUsd.toFixed(4)} on ${fx.data.date}.` : ' when it can be loaded.'}
      </Text>

      <SectionTitle>Backup</SectionTitle>
      <BackupSection />

      <SectionTitle>About</SectionTitle>
      <View style={styles.block}>
        <Row label="Version" value={version} />
        <Row label="Card data" value="TCGdex" />
        <Row label="Prices" value="TCGplayer and Cardmarket via TCGdex" />
        <Row label="Exchange rate" value="European Central Bank via Frankfurter" />
        <Row label="Price history" value="Recorded on this phone, once a day" last />
      </View>

      <Text style={styles.note}>
        Prices are estimates and can be out of date; each price shows its source and date.
        PokeWorth is not affiliated with Nintendo or The Pokémon Company.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  block: {
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md + 2 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { ...type.body, color: colors.textSecondary },
  value: { ...type.body, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  note: { ...type.caption, fontWeight: '400', lineHeight: 18, color: colors.textTertiary },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.gold400 },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  segmentTextOn: { color: colors.textOnGold },
});

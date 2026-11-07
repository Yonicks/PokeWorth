import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenTitle, SectionTitle } from '@/components/screen';
import { colors, radius, space, type } from '@/theme/tokens';

/** Profile tab: app info for now; settings land here as features need them. */
export default function ProfileScreen() {
  const version = Constants.expoConfig?.version ?? 'unknown';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle>Profile</ScreenTitle>

      <SectionTitle>About</SectionTitle>
      <View style={styles.block}>
        <Row label="Version" value={version} />
        <Row label="Card data" value="TCGdex" />
        <Row label="Prices" value="TCGplayer and Cardmarket via TCGdex" last />
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
});

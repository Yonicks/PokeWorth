/** Shared dark layout pieces for the tab screens. */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, type } from '@/theme/tokens';

/** Top-of-screen title that clears the notch / status bar. */
export function ScreenTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.titleRow, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.title} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Centred message for empty or not-yet-built states. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.md,
  },
  title: { ...type.title, color: colors.textPrimary },
  section: { ...type.section, color: colors.textPrimary, marginTop: space.lg },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl * 2, paddingHorizontal: space.lg },
  emptyTitle: { ...type.cardTitle, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { ...type.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 320 },
});

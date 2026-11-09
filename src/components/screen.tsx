/** Shared dark layout pieces for the tab screens. */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeError, isRetryable } from '@/services/api-error';
import { colors, radius, space, type } from '@/theme/tokens';

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

/** Centred spinner with a short text, for screens waiting on the network. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.empty} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.goldText} />
      <Text style={styles.emptyBody}>{label}</Text>
    </View>
  );
}

/** Friendly failure message with a Retry button (typed error text from describeError). */
export function ErrorState({
  title = 'Something went wrong',
  error,
  subject,
  onRetry,
}: {
  title?: string;
  error: unknown;
  subject?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{describeError(error, subject)}</Text>
      {onRetry && isRetryable(error) ? (
        <Pressable
          style={styles.retry}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  retry: {
    backgroundColor: colors.gold400,
    borderRadius: radius.card,
    paddingHorizontal: space.xl,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: space.sm,
  },
  retryText: { fontWeight: '700', color: colors.textOnGold },
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

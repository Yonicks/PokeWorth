/** Scan log (S0): how long each scan step took, what was read, and which scans were wrong. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMs,
  timingText,
  toReport,
  typicalTimings,
  VERDICT_LABELS,
  verdictOf,
  type ScanLogEntry,
  type Verdict,
} from '@/services/scan-log.model';
import { clearScanLog, loadScanLog } from '@/services/scan-log.service';
import { colors, radius, space, type } from '@/theme/tokens';

const VERDICT_COLOR: Record<Verdict, string> = {
  wrong: colors.down,
  fixed: colors.goldText,
  'picked-other': colors.goldText,
  matched: colors.up,
  unconfirmed: colors.textTertiary,
};

function Entry({ e }: { e: ScanLogEntry }) {
  const [open, setOpen] = useState(false);
  const verdict = verdictOf(e);
  const title =
    e.kind === 'binder'
      ? `Binder page · ${Object.values(e.pockets ?? {}).reduce((a, b) => a + b, 0)} pockets`
      : [e.name ?? 'No name read', e.number ? `№${e.number}${e.total ? `/${e.total}` : ''}` : undefined].filter(Boolean).join(' · ');
  const detail =
    e.kind === 'binder'
      ? Object.entries(e.pockets ?? {}).map(([k, n]) => `${n} ${k}`).join(', ')
      : [
          e.ocr ? `read by ${e.ocr}` : undefined,
          e.candidates !== undefined ? `${e.candidates} candidates${e.confident ? ', confident' : ''}` : undefined,
          e.topCardId ? `top ${e.topCardId}` : undefined,
          e.openedCardId ? `opened ${e.openedCardId}` : undefined,
          e.wrongCardId ? `wrong ${e.wrongCardId}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <Pressable
      style={styles.entry}
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}, ${VERDICT_LABELS[verdict]}`}>
      <View style={styles.entryHead}>
        <Text style={styles.entryTitle} numberOfLines={open ? undefined : 1}>
          {title}
        </Text>
        {e.kind === 'card' ? (
          <Text style={[styles.pill, { color: VERDICT_COLOR[verdict], borderColor: VERDICT_COLOR[verdict] }]}>
            {VERDICT_LABELS[verdict]}
          </Text>
        ) : null}
      </View>
      <Text style={styles.time}>{new Date(e.at).toLocaleString()}</Text>
      <Text style={styles.timing}>{timingText(e)}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {open && e.lines.length > 0 ? (
        <View style={styles.lines}>
          {e.lines.map((l, i) => (
            <Text key={i} style={styles.line}>
              {i + 1}. {l}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ScanLogScreen() {
  const client = useQueryClient();
  const log = useQuery({ queryKey: ['scanLog'], queryFn: loadScanLog, staleTime: 0 });
  const [message, setMessage] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);
  const entries = log.data ?? [];
  const typical = typicalTimings(entries);

  const copy = async () => {
    try {
      const ok = await Clipboard.setStringAsync(toReport(entries));
      setMessage(ok ? `Copied ${entries.length} entries.` : 'Could not copy.');
    } catch {
      setMessage('Could not copy.');
    }
  };

  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearScanLog();
    setConfirmClear(false);
    setMessage('Scan log cleared.');
    await client.invalidateQueries({ queryKey: ['scanLog'] });
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={entries}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <Entry e={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.note}>
            Every scan on this phone, newest first: time per step, the text that was read, and whether you
            corrected it. It stays here until you copy it.
          </Text>
          {typical.count > 0 ? (
            <View style={styles.summary} accessibilityLabel="Typical time per card scan">
              <Text style={styles.summaryTitle}>Typical card scan ({typical.count})</Text>
              <Text style={styles.summaryText}>
                {[
                  typical.photoMs !== undefined ? `photo ${formatMs(typical.photoMs)}` : undefined,
                  typical.readMs !== undefined ? `read ${formatMs(typical.readMs)}` : undefined,
                  typical.matchMs !== undefined ? `match ${formatMs(typical.matchMs)}` : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.primary]} onPress={copy} disabled={entries.length === 0} accessibilityRole="button">
              <Text style={styles.primaryText}>Copy log</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={clear} disabled={entries.length === 0} accessibilityRole="button">
              <Text style={[styles.buttonText, confirmClear && { color: colors.down }]}>
                {confirmClear ? 'Tap again to clear' : 'Clear'}
              </Text>
            </Pressable>
          </View>
          {message ? (
            <Text style={styles.note} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        log.isLoading ? undefined : (
          <Text style={styles.note}>
            No scans yet. Scan a card or a binder page and it shows up here with its timings.
          </Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  header: { gap: space.md, marginBottom: space.sm },
  note: { ...type.caption, fontWeight: '400', lineHeight: 18, color: colors.textTertiary },
  summary: {
    padding: space.lg,
    gap: 2,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { ...type.caption, color: colors.textSecondary },
  summaryText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  button: {
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  primaryText: { fontSize: 15, fontWeight: '700', color: colors.textOnGold },
  entry: {
    gap: 2,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  entryTitle: { flex: 1, minWidth: 0, ...type.cardTitle, color: colors.textPrimary },
  pill: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  time: { ...type.caption, fontWeight: '400', color: colors.textTertiary },
  timing: { fontSize: 14, fontWeight: '600', color: colors.goldText, fontVariant: ['tabular-nums'] },
  detail: { ...type.caption, fontWeight: '400', color: colors.textSecondary },
  lines: { marginTop: space.sm, gap: 2 },
  line: { fontSize: 13, color: colors.textSecondary },
});

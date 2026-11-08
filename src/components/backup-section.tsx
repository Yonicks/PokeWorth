/** Profile → Backup: save the collection to a file and restore it. */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { applyBackup, exportBackup, pickBackup } from '@/services/backup.service';
import { summarizeBackup, type BackupData } from '@/services/backup.model';
import { colors, radius, space, type } from '@/theme/tokens';

export function BackupSection() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean }>();
  const [pending, setPending] = useState<BackupData | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    const r = await exportBackup();
    setMessage(r.ok ? { text: `Backup ready: ${r.name}` } : { text: r.error, bad: true });
    setBusy(false);
  };

  const choose = async () => {
    setBusy(true);
    setMessage(undefined);
    const r = await pickBackup();
    if (r.ok) setPending(r.data);
    else if (!r.cancelled) setMessage({ text: r.error, bad: true });
    setBusy(false);
  };

  const apply = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setBusy(true);
    try {
      await applyBackup(client, pending, mode);
      setMessage({ text: mode === 'merge' ? 'Backup added to your collection.' : 'Your collection was replaced by the backup.' });
    } catch {
      setMessage({ text: 'Could not restore the backup.', bad: true });
    }
    setPending(null);
    setBusy(false);
  };

  const s = pending ? summarizeBackup(pending) : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        Your cards live only on this phone. Save a backup file somewhere safe (Files, Drive, email) so you can bring
        them back after a reinstall or on a new phone.
      </Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.primary]} onPress={save} disabled={busy} accessibilityRole="button">
          <Text style={styles.primaryText}>Save backup</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={choose} disabled={busy} accessibilityRole="button">
          <Text style={styles.buttonText}>Restore…</Text>
        </Pressable>
        {busy ? <ActivityIndicator color={colors.goldText} /> : null}
      </View>

      {s ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Backup found: {s.copies} card{s.copies === 1 ? '' : 's'} in {s.portfolios} portfolio{s.portfolios === 1 ? '' : 's'}
          </Text>
          <Text style={styles.note}>
            “Add to my cards” keeps everything on this phone and adds what is missing (the larger quantity wins).
            “Replace” erases this phone’s collection and uses only the backup.
          </Text>
          <Pressable style={[styles.button, styles.primary]} onPress={() => apply('merge')} accessibilityRole="button">
            <Text style={styles.primaryText}>Add to my cards</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.danger]} onPress={() => apply('replace')} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.down }]}>Replace everything</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setPending(null)} accessibilityRole="button">
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <Text style={[styles.note, message.bad && { color: colors.down }]} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  note: { ...type.caption, fontWeight: '400', lineHeight: 18, color: colors.textTertiary },
  buttons: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
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
  danger: { borderColor: colors.down },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  primaryText: { fontSize: 15, fontWeight: '700', color: colors.textOnGold },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
});

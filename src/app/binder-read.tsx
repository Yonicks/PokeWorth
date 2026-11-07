import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBinderCapture } from '@/services/binder-capture';
import { cropPockets, type PocketImage } from '@/services/binder-crop.service';
import { LAYOUTS, pocketLabel } from '@/services/binder-grid.model';
import { summarize, type PocketStatus } from '@/services/binder-scan.model';
import { readPocket, readPockets, type PocketResult } from '@/services/binder-scan.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';

const STATUS: Record<PocketStatus | 'reading', { label: string; color: string }> = {
  sure: { label: 'Sure', color: colors.up },
  check: { label: 'Check', color: '#F6B35B' },
  notfound: { label: 'Not found', color: colors.down },
  empty: { label: 'Empty', color: colors.textTertiary },
  error: { label: 'Error', color: colors.down },
  reading: { label: 'Reading…', color: colors.goldText },
};

function PocketTile({ pocket, result }: { pocket: PocketImage; result?: PocketResult }) {
  const status = result?.status ?? 'reading';
  const s = STATUS[status];
  const top = result?.outcome?.candidates[0]?.card;
  const showCard = top && (status === 'sure' || status === 'check');
  return (
    <View
      style={[styles.tile, status === 'reading' && styles.tileReading]}
      accessibilityLabel={`${pocketLabel(pocket)}: ${s.label}${showCard ? `, ${top.name}` : ''}`}>
      <Image
        source={{ uri: showCard && top.image ? cardImageUrl(top.image, 'low') : pocket.uri }}
        style={[styles.thumb, status === 'empty' && styles.thumbEmpty]}
        contentFit="contain"
      />
      <View style={[styles.stripe, { backgroundColor: s.color }]} />
      <Text style={styles.status} numberOfLines={1}>
        {s.label}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {showCard ? top.name : status === 'error' ? (result?.error ?? '') : status === 'reading' ? '' : '—'}
      </Text>
      {showCard ? (
        <Text style={styles.meta} numberOfLines={1}>
          #{top.localId}
        </Text>
      ) : null}
    </View>
  );
}

export default function BinderReadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const capture = getBinderCapture(typeof id === 'string' ? id : undefined);
  const [pockets, setPockets] = useState<PocketImage[]>([]);
  const [results, setResults] = useState<Record<number, PocketResult>>({});
  const [phase, setPhase] = useState<'cropping' | 'reading' | 'done' | 'cancelled' | 'failed'>('cropping');
  const abortRef = useRef<AbortController | null>(null);

  const read = useCallback(async (list: PocketImage[]) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('reading');
    await readPockets(list, {
      signal: ac.signal,
      onResult: (r) => setResults((prev) => ({ ...prev, [r.index]: r })),
    });
    setPhase(ac.signal.aborted ? 'cancelled' : 'done');
  }, []);

  useEffect(() => {
    if (!capture) return;
    let alive = true;
    cropPockets(capture.uri, capture.layout, { frame: capture.frame })
      .then((list) => {
        if (!alive) return;
        setPockets(list);
        return read(list);
      })
      .catch((e) => {
        if (__DEV__) console.warn('Cropping failed', e);
        if (alive) setPhase('failed');
      });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
    // Run once per captured page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture?.id]);

  const retryFailed = async () => {
    const failed = pockets.filter((p) => results[p.index]?.status === 'error');
    setPhase('reading');
    for (const p of failed) {
      const r = await readPocket(p);
      setResults((prev) => ({ ...prev, [r.index]: r }));
    }
    setPhase('done');
  };

  if (!capture) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>This page photo is no longer available. Take it again.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/binder-scan')} accessibilityRole="button">
          <Text style={styles.primaryText}>Scan a page</Text>
        </Pressable>
      </View>
    );
  }

  const { cols } = LAYOUTS[capture.layout];
  const done = Object.keys(results).length;
  const total = pockets.length || LAYOUTS[capture.layout].cols * LAYOUTS[capture.layout].rows;
  const sum = summarize(Object.values(results).map((r) => r.status));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header" accessibilityLiveRegion="polite">
        {phase === 'cropping'
          ? 'Cutting the page into pockets…'
          : phase === 'reading'
            ? `Reading pocket ${Math.min(done + 1, total)} of ${total}…`
            : phase === 'cancelled'
              ? `Stopped after ${done} of ${total} pockets`
              : phase === 'failed'
                ? 'Could not open this photo'
                : `${sum.found} card${sum.found === 1 ? '' : 's'} found`}
      </Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(done / total) * 100}%` }]} />
      </View>
      {phase === 'done' || phase === 'cancelled' ? (
        <Text style={styles.summary}>
          {[
            sum.sure && `${sum.sure} Sure`,
            sum.check && `${sum.check} to check`,
            sum.notfound && `${sum.notfound} not found`,
            sum.empty && `${sum.empty} empty`,
            sum.error && `${sum.error} failed`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}

      {phase === 'cropping' ? <ActivityIndicator style={{ marginTop: space.xl }} color={colors.goldText} /> : null}

      <View style={styles.grid}>
        {pockets.map((p) => (
          <View key={p.index} style={{ width: `${100 / cols}%`, padding: 4 }}>
            <PocketTile pocket={p} result={results[p.index]} />
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {phase === 'reading' ? (
          <Pressable style={styles.secondary} onPress={() => abortRef.current?.abort()} accessibilityRole="button">
            <Text style={styles.secondaryText}>Stop reading</Text>
          </Pressable>
        ) : null}
        {(phase === 'done' || phase === 'cancelled') && sum.error > 0 ? (
          <Pressable style={styles.secondary} onPress={retryFailed} accessibilityRole="button">
            <Text style={styles.secondaryText}>Retry {sum.error} failed</Text>
          </Pressable>
        ) : null}
        {phase !== 'reading' && phase !== 'cropping' ? (
          <Pressable style={styles.secondary} onPress={() => router.replace('/binder-scan')} accessibilityRole="button">
            <Text style={styles.secondaryText}>Scan another page</Text>
          </Pressable>
        ) : null}
      </View>
      {phase === 'done' ? (
        <Text style={styles.note}>
          Ticking, fixing and adding these cards to your portfolio arrive in the next steps.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.bg },
  body: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  heading: { ...type.section, color: colors.textPrimary },
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold400 },
  summary: { ...type.cardMeta, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  tile: {
    padding: 6,
    gap: 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 190,
  },
  tileReading: { borderColor: colors.gold400 },
  thumb: { width: '100%', aspectRatio: 63 / 88, borderRadius: 4, backgroundColor: colors.raised },
  thumbEmpty: { opacity: 0.4 },
  stripe: { height: 4, borderRadius: 2, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  name: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textTertiary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  primary: { minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.card, backgroundColor: colors.gold400, justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.textOnGold },
  secondary: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  note: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});

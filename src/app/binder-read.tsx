import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PocketSheet } from '@/components/binder-pocket-sheet';
import { Icon } from '@/components/icons';
import { PriceTag } from '@/components/price-tag';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import { planAdd } from '@/services/binder-add.service';
import { getBinderCapture } from '@/services/binder-capture';
import { cropPockets, type PocketImage } from '@/services/binder-crop.service';
import { LAYOUTS, pocketLabel } from '@/services/binder-grid.model';
import {
  canAdd,
  chooseCard,
  choosePrinting,
  initReview,
  skipPocket,
  tickedCount,
  toggleTick,
  type ReviewPocket,
} from '@/services/binder-review.model';
import { summarize, type PocketStatus } from '@/services/binder-scan.model';
import { readPocket, readPockets, type PocketResult } from '@/services/binder-scan.service';
import { addMany, cardQuantity } from '@/services/collection.model';
import { formatTotals } from '@/services/printings.service';
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

function PocketTile({
  pocket,
  result,
  review,
  onOpen,
  onTick,
  onPeek,
  owned,
}: {
  pocket: PocketImage;
  result?: PocketResult;
  review?: ReviewPocket;
  /** Copies of the picked card already in the active portfolio. */
  owned: number;
  onOpen: () => void;
  onTick: () => void;
  onPeek: () => void;
}) {
  const status = result?.status ?? 'reading';
  const s = STATUS[status];
  const card = review?.candidates.find((c) => c.id === review.cardId);
  const reviewable = !!review;
  return (
    <Pressable
      onPress={reviewable ? onOpen : undefined}
      onLongPress={onPeek}
      delayLongPress={350}
      style={[styles.tile, status === 'reading' && styles.tileReading, review?.ticked && styles.tileTicked]}
      accessibilityRole="button"
      accessibilityLabel={`${pocketLabel(pocket)}: ${review?.unsure ? 'printing unsure' : s.label}${card ? `, ${card.name}` : ''}${owned > 0 ? `, you already own ${owned}` : ''}${review?.ticked ? ', ticked' : ''}`}
      accessibilityHint={reviewable ? 'Opens this pocket to change the match. Hold to see your photo of it.' : 'Hold to see your photo of it.'}
      accessibilityActions={[{ name: 'longpress', label: 'Show my photo of this pocket' }]}
      onAccessibilityAction={() => onPeek()}>
      <Image
        source={{ uri: card?.image ? cardImageUrl(card.image, 'low') : pocket.uri }}
        style={[styles.thumb, status === 'empty' && styles.thumbEmpty]}
        contentFit="contain"
      />
      {review && canAdd(review) ? (
        <Pressable
          onPress={onTick}
          hitSlop={8}
          style={[styles.checkbox, review.ticked && styles.checkboxOn]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: review.ticked }}
          accessibilityLabel={`Add ${card?.name ?? 'this card'}`}>
          {review.ticked ? <Icon name="check" color={colors.textOnGold} size={16} /> : null}
        </Pressable>
      ) : null}
      <View style={[styles.stripe, { backgroundColor: s.color }]} />
      <Text style={styles.status} numberOfLines={1}>
        {review?.unsure ? 'Printing unsure' : s.label}
      </Text>
      {review?.unsure ? (
        <Text style={styles.unsure} numberOfLines={1}>
          {review.variants > 24 ? '25+' : review.variants} possible, tap to pick
        </Text>
      ) : null}
      {owned > 0 ? (
        <Text style={styles.owned} numberOfLines={1}>
          You own ×{owned}
        </Text>
      ) : null}
      <Text style={styles.name} numberOfLines={2}>
        {card ? card.name : status === 'error' ? (result?.error ?? '') : status === 'reading' ? '' : '—'}
      </Text>
      {card ? (
        <Text style={styles.meta} numberOfLines={1}>
          #{card.localId}
        </Text>
      ) : null}
      {card ? <PriceTag cardId={card.id} printingId={review?.printingId} /> : null}
    </Pressable>
  );
}

export default function BinderReadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const collection = useCollection();
  const update = useUpdateCollection();
  const { id } = useLocalSearchParams<{ id: string }>();
  const capture = getBinderCapture(typeof id === 'string' ? id : undefined);
  const [pockets, setPockets] = useState<PocketImage[]>([]);
  const [results, setResults] = useState<Record<number, PocketResult>>({});
  const [review, setReview] = useState<ReviewPocket[] | null>(null);
  const [phase, setPhase] = useState<'cropping' | 'reading' | 'done' | 'cancelled' | 'failed'>('cropping');
  const [open, setOpen] = useState<number | null>(null);
  const [peek, setPeek] = useState<PocketImage | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ cards: number; copies: number; value: string; failed: number; into: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Always the latest collection, for the review that starts when reading ends.
  const ownedRef = useRef<(cardId: string) => number>(() => 0);
  useEffect(() => {
    ownedRef.current = (cardId) => (collection.data ? cardQuantity(collection.data, cardId) : 0);
  }, [collection.data]);

  const read = useCallback(async (list: PocketImage[]) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('reading');
    const all = await readPockets(list, {
      signal: ac.signal,
      onResult: (r) => setResults((prev) => ({ ...prev, [r.index]: r })),
    });
    // Reading is over: start the review from what was read (later retries keep the user's choices).
    // Pockets never started (stopped early, e.g. at the reading limit) show as errors too.
    setResults((prev) => ({ ...prev, ...Object.fromEntries(all.map((r) => [r.index, r])) }));
    setReview(initReview(all, (id) => ownedRef.current(id)));
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
    const fresh: PocketResult[] = [];
    for (const p of failed) {
      const r = await readPocket(p);
      fresh.push(r);
      setResults((prev) => ({ ...prev, [r.index]: r }));
    }
    const redo = initReview(fresh, (id) => ownedRef.current(id));
    setReview((prev) => (prev ? prev.map((p) => redo.find((r) => r.index === p.index) ?? p) : prev));
    setPhase('done');
  };

  const addAll = async () => {
    if (!review || !collection.data || adding) return;
    setAdding(true);
    try {
      const plan = await planAdd(client, review);
      if (plan.items.length > 0) await update.mutateAsync((s) => addMany(s, plan.items));
      const portfolio = collection.data.portfolios.find((p) => p.id === collection.data!.activePortfolioId);
      setAdded({ cards: plan.cards, copies: plan.copies, value: formatTotals(plan.value), failed: plan.failed, into: portfolio?.name ?? 'Main' });
    } finally {
      setAdding(false);
    }
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

  if (added) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle} accessibilityRole="header" accessibilityLiveRegion="polite">
          {added.copies === 0 ? 'Nothing was added' : `Added ${added.copies} card${added.copies === 1 ? '' : 's'} to ${added.into}`}
        </Text>
        {added.copies > 0 ? <Text style={styles.body}>{added.value} at today’s market prices</Text> : null}
        {added.failed > 0 ? (
          <Text style={styles.error}>
            {added.failed} card{added.failed === 1 ? '' : 's'} could not be loaded and {added.failed === 1 ? 'was' : 'were'} not added.
          </Text>
        ) : null}
        <Pressable style={styles.primary} onPress={() => router.replace('/binder-scan')} accessibilityRole="button">
          <Text style={styles.primaryText}>Scan next page</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace('/portfolio')} accessibilityRole="button">
          <Text style={styles.secondaryText}>View portfolio</Text>
        </Pressable>
      </View>
    );
  }

  const { cols, rows } = LAYOUTS[capture.layout];
  const done = Object.keys(results).length;
  const total = pockets.length || cols * rows;
  const sum = summarize(Object.values(results).map((r) => r.status));
  const ticked = review ? tickedCount(review) : 0;
  const openPocket = review?.find((p) => p.index === open) ?? null;
  const reviewing = phase === 'done' || phase === 'cancelled';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: reviewing ? 120 : space.xl * 2 }]}>
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
        {__DEV__ && pockets.length > 0 ? (
          <Text style={styles.debug}>
            DEBUG pocket {pockets[0].width}×{pockets[0].height} px, frame{' '}
            {capture.frame === 'full' ? 'whole photo' : `${capture.frame.width}×${capture.frame.height} at ${capture.frame.originX},${capture.frame.originY}`}
          </Text>
        ) : null}
        {reviewing ? (
          <Text style={styles.summary}>
            {[
              sum.sure && `${sum.sure} Sure (ticked)`,
              sum.check && `${sum.check} to check`,
              sum.notfound && `${sum.notfound} not found`,
              sum.empty && `${sum.empty} empty`,
              sum.error && `${sum.error} failed`,
            ]
              .filter(Boolean)
              .join(' · ')}
            {'. Tap a pocket to change it.'}
          </Text>
        ) : null}

        {phase === 'cropping' ? <ActivityIndicator style={{ marginTop: space.xl }} color={colors.goldText} /> : null}

        <View style={styles.grid}>
          {pockets.map((p) => {
            const r = review?.find((x) => x.index === p.index);
            return (
              <View key={p.index} style={{ width: `${100 / cols}%`, padding: 4 }}>
                <PocketTile
                  pocket={p}
                  result={results[p.index]}
                  review={r}
                  onOpen={() => setOpen(p.index)}
                  onTick={() => setReview((cur) => (cur ? toggleTick(cur, p.index) : cur))}
                  onPeek={() => setPeek(p)}
                  owned={r?.cardId && collection.data ? cardQuantity(collection.data, r.cardId) : 0}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          {phase === 'reading' ? (
            <Pressable style={styles.secondary} onPress={() => abortRef.current?.abort()} accessibilityRole="button">
              <Text style={styles.secondaryText}>Stop reading</Text>
            </Pressable>
          ) : null}
          {reviewing && sum.error > 0 ? (
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
      </ScrollView>

      {reviewing && review ? (
        <View style={[styles.addBar, { paddingBottom: insets.bottom + space.md }]}>
          <Pressable
            style={[styles.addButton, (ticked === 0 || adding) && styles.addOff]}
            onPress={addAll}
            disabled={ticked === 0 || adding || !collection.data}
            accessibilityRole="button">
            {adding ? (
              <ActivityIndicator color={colors.textOnGold} />
            ) : (
              <Text style={styles.addText}>
                {ticked === 0
                  ? 'Tick the cards to add'
                  : `Add ${ticked} card${ticked === 1 ? '' : 's'} to ${collection.data?.portfolios.find((p) => p.id === collection.data!.activePortfolioId)?.name ?? 'Main'}`}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!peek} transparent animationType="fade" onRequestClose={() => setPeek(null)}>
        <Pressable
          style={styles.peek}
          onPress={() => setPeek(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo">
          {peek ? (
            <>
              <Image source={{ uri: peek.uri }} style={styles.peekImage} contentFit="contain" />
              <Text style={styles.peekHint}>{pocketLabel(peek)} · your photo. Tap to close.</Text>
            </>
          ) : null}
        </Pressable>
      </Modal>

      <PocketSheet
        pocket={openPocket}
        onClose={() => setOpen(null)}
        onChooseCard={(c) => open !== null && setReview((cur) => (cur ? chooseCard(cur, open, c) : cur))}
        onChoosePrinting={(pid) => open !== null && setReview((cur) => (cur ? choosePrinting(cur, open, pid) : cur))}
        onSkip={() => open !== null && setReview((cur) => (cur ? skipPocket(cur, open) : cur))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.bg },
  body: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...type.body, color: colors.down, textAlign: 'center' },
  doneTitle: { ...type.title, fontSize: 24, color: colors.textPrimary, textAlign: 'center' },
  heading: { ...type.section, color: colors.textPrimary },
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold400 },
  summary: { ...type.cardMeta, color: colors.textSecondary },
  debug: { fontFamily: 'Courier', fontSize: 11, color: '#f6b35b' },
  unsure: { fontSize: 11, lineHeight: 14, color: '#F6B35B' },
  owned: { fontSize: 12, lineHeight: 15, fontWeight: '700', color: colors.goldText },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  tile: { padding: 6, gap: 3, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 190 },
  tileReading: { borderColor: colors.gold400 },
  tileTicked: { borderColor: colors.gold400, borderWidth: 2 },
  thumb: { width: '100%', aspectRatio: 63 / 88, borderRadius: 4, backgroundColor: colors.raised },
  thumbEmpty: { opacity: 0.4 },
  checkbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    backgroundColor: 'rgba(3,18,41,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  peek: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  peekImage: { width: '100%', flex: 1 },
  peekHint: { fontSize: 14, color: colors.textSecondary },
  stripe: { height: 4, borderRadius: 2, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  name: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textTertiary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  primary: { minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.card, backgroundColor: colors.gold400, justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.textOnGold },
  secondary: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  addBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.bgBottom, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  addButton: { minHeight: 52, borderRadius: radius.card, backgroundColor: colors.gold400, alignItems: 'center', justifyContent: 'center' },
  addOff: { opacity: 0.5 },
  addText: { fontSize: 17, fontWeight: '700', color: colors.textOnGold },
});

import { useQueries } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/screen';
import { useCollection } from '@/hooks/use-collection';
import { listText, listTotals, tradeLines, wantIds, type ListLine } from '@/services/lists.model';
import { defaultPrinting, formatTotals, printingsFor } from '@/services/printings.service';
import { getCard } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';

type Tab = 'trade' | 'want';

function Line({ line, onPress }: { line: ListLine; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>
          {line.qty ? `${line.qty}× ` : ''}
          {line.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[line.setName, line.number ? `#${line.number}` : undefined, line.printing].filter(Boolean).join(' • ')}
        </Text>
      </View>
      <Text style={styles.price}>
        {line.price ? formatTotals({ [line.price.currency]: line.price.amount * (line.qty ?? 1) }) : '—'}
      </Text>
    </Pressable>
  );
}

export default function ListsScreen() {
  const router = useRouter();
  const collection = useCollection();
  const [tab, setTab] = useState<Tab>('trade');
  const [notice, setNotice] = useState<string>();
  const state = collection.data;
  const portfolio = state?.portfolios.find((p) => p.id === state.activePortfolioId)?.name ?? 'Main';

  const trade = useMemo(() => (state ? tradeLines(state) : []), [state]);
  const ids = useMemo(() => (state ? wantIds(state) : []), [state]);
  const wanted = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['card', id],
      queryFn: () => getCard(id),
      staleTime: 1000 * 60 * 10,
    })),
  });
  const wantLoading = wanted.some((q) => q.isLoading);
  const want: (ListLine & { id: string })[] = wanted.flatMap((q, i) => {
    if (!q.data) return [];
    const printing = defaultPrinting(printingsFor(q.data));
    const price = printing?.prices[0];
    const official = q.data.set?.cardCount?.official;
    return [
      {
        id: ids[i],
        name: q.data.name,
        setName: q.data.set?.name,
        number: official ? `${q.data.localId}/${official}` : q.data.localId,
        price: price ? { amount: price.amount, currency: price.currency } : undefined,
      },
    ];
  });

  const lines: ListLine[] = tab === 'trade' ? trade : want;
  const title = tab === 'trade' ? `Trade list — ${portfolio}` : 'Want list';
  const text = listText(title, lines, true);
  const totals = listTotals(lines);

  const share = async () => {
    try {
      await Share.share({ message: text });
    } catch {
      setNotice('Sharing is not available on this device.');
    }
  };
  const copy = async () => {
    try {
      if (await Clipboard.setStringAsync(text)) setNotice('List copied. Paste it into any chat.');
    } catch {
      setNotice('Could not copy the list.');
    }
  };

  if (!state) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.goldText} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {(
          [
            ['trade', `Trade (${trade.length})`],
            ['want', `Want (${ids.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.segmentItem, tab === id && styles.segmentOn]}
            onPress={() => {
              setTab(id);
              setNotice(undefined);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: tab === id }}>
            <Text style={[styles.segmentText, tab === id && styles.segmentTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        {tab === 'trade'
          ? 'Your spare copies: everything beyond the first of each printing. Graded cards are not listed.'
          : 'Your favourite cards that you do not own yet. Star a card to add it.'}
      </Text>

      {tab === 'want' && wantLoading ? <ActivityIndicator color={colors.goldText} /> : null}

      {lines.length === 0 && !(tab === 'want' && wantLoading) ? (
        <EmptyState
          title={tab === 'trade' ? 'No spare cards' : 'Nothing on your want list'}
          body={
            tab === 'trade'
              ? 'When you own two or more of the same printing, the extra copies show up here.'
              : 'Tap the star on a card you do not own to add it here.'
          }
        />
      ) : (
        <View style={styles.list}>
          {tab === 'trade'
            ? trade.map((l, i) => <Line key={`${l.name}-${l.number}-${l.printing}-${i}`} line={l} />)
            : want.map((l) => (
                <Line key={l.id} line={l} onPress={() => router.push({ pathname: '/result', params: { id: l.id } })} />
              ))}
        </View>
      )}

      {lines.length > 0 ? (
        <>
          {Object.keys(totals).length > 0 ? (
            <Text style={styles.total}>
              {tab === 'trade' ? 'Spare copies worth' : 'To buy them all'} {formatTotals(totals)}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.primary]} onPress={share} accessibilityRole="button">
              <Text style={styles.primaryText}>Share list</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={copy} accessibilityRole="button">
              <Text style={styles.buttonText}>Copy text</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {notice ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.md },
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
  note: { ...type.caption, fontWeight: '400', lineHeight: 18, color: colors.textTertiary },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  price: { fontSize: 16, fontWeight: '700', color: colors.price, fontVariant: ['tabular-nums'] },
  total: { ...type.cardTitle, color: colors.textPrimary, textAlign: 'center', marginTop: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  button: {
    minHeight: 48,
    paddingHorizontal: space.xl,
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
});

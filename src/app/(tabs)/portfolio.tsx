import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { PortfolioSwitcher } from '@/components/portfolio-switcher';
import { EmptyState } from '@/components/screen';
import { useCollection, useUpdateCollection } from '@/hooks/use-collection';
import {
  byValue,
  entriesIn,
  moveEntries,
  removeEntries,
  toCsv,
  totals,
  type CollectionEntry,
} from '@/services/collection.model';
import { updateHistory, withCard } from '@/services/history.service';
import { refreshPortfolioPrices } from '@/services/portfolio-refresh';
import { TotalValue } from '@/components/total-value';
import { HISTORY_KEY, useFxRate } from '@/hooks/use-history';
import { sortValue } from '@/services/currency.model';
import { formatMoney } from '@/services/printings.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import { normalize } from '@/utils/text';
import { colors, radius, space, type } from '@/theme/tokens';

type Sort = 'value' | 'recent';

const EntryTile = memo(function EntryTile({
  entry,
  selecting,
  selected,
  onPress,
}: {
  entry: CollectionEntry;
  selecting: boolean;
  selected: boolean;
  onPress: (e: CollectionEntry) => void;
}) {
  const value = entry.price ? entry.price.amount * entry.quantity : undefined;
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
      onPress={() => onPress(entry)}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={`${entry.card.name}, ${entry.printingLabel}, quantity ${entry.quantity}`}>
      {entry.card.image ? (
        <Image source={{ uri: cardImageUrl(entry.card.image, 'low') }} style={styles.art} contentFit="contain" />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}
      {selecting ? (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Icon name="check" color={colors.textOnGold} size={16} /> : null}
        </View>
      ) : null}
      <Text style={styles.name} numberOfLines={2}>
        {entry.card.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {entry.card.setName ?? 'Unknown set'}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {[entry.card.rarity, entry.card.number ?? entry.card.localId].filter(Boolean).join(' • ')}
      </Text>
      <Text style={styles.condition} numberOfLines={1}>
        <Text style={entry.graded ? styles.conditionGraded : styles.conditionGood}>{entry.condition}</Text> •{' '}
        {entry.printingLabel}
      </Text>
      <View style={styles.tileFoot}>
        <Text style={styles.qty}>{entry.graded ? (entry.price ? 'Your value' : 'Graded') : `Qty: ${entry.quantity}`}</Text>
        <Text style={styles.value}>
          {value !== undefined ? formatMoney(value, entry.price!.currency) : 'No price'}
        </Text>
      </View>
    </Pressable>
  );
});

function Action({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button">
      <View style={[styles.actionIcon, active && styles.actionIconOn]}>
        <Icon name={icon} color={active ? colors.textOnGold : colors.goldText} size={22} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const collection = useCollection();
  const update = useUpdateCollection();

  const [filter, setFilter] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('value');
  const fx = useFxRate();
  const [hidden, setHidden] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string>();

  const state = collection.data;
  const all = useMemo(() => (state ? entriesIn(state) : []), [state]);
  const shown = useMemo(() => {
    const f = normalize(filter);
    let list = all.filter(
      (e) =>
        (!favOnly || state?.favorites.includes(e.cardId)) &&
        (!f || normalize(`${e.card.name} ${e.card.setName ?? ''}`).includes(f)),
    );
    const rate = fx.data ?? undefined;
    list =
      sort === 'value'
        ? byValue(list, (a, c) => sortValue(a, c, rate))
        : [...list].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return list;
  }, [all, filter, favOnly, sort, state?.favorites, fx.data]);

  if (!state) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.goldText} />
      </View>
    );
  }

  const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
  const t = totals(all);
  const others = state.portfolios.filter((p) => p.id !== state.activePortfolioId);

  const onTile = (e: CollectionEntry) => {
    if (!selecting) {
      router.push({ pathname: '/result', params: { id: e.cardId } });
      return;
    }
    setConfirmDelete(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
  };

  const endSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    setNotice(undefined);
    try {
      const { change, cards, failed } = await refreshPortfolioPrices(client, state);
      await update.mutateAsync(change);
      const h = await updateHistory((x) => cards.reduce((acc, c) => withCard(acc, c), x));
      client.setQueryData(HISTORY_KEY, h);
      setNotice(failed ? `Prices updated. ${failed} card${failed === 1 ? '' : 's'} could not be refreshed.` : 'Prices updated.');
    } catch {
      setNotice('Could not refresh prices. Check your connection.');
    } finally {
      setRefreshing(false);
    }
  };

  const exportCsv = async () => {
    try {
      await Share.share({ title: `${portfolio?.name ?? 'Portfolio'}.csv`, message: toCsv(state) });
    } catch {
      setNotice('Sharing is not available on this device.');
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Icon name="search" color={colors.textTertiary} size={18} />
          <TextInput
            style={styles.input}
            placeholder="Search your collection"
            placeholderTextColor={colors.textTertiary}
            value={filter}
            onChangeText={setFilter}
            autoCorrect={false}
            accessibilityLabel="Search your collection"
          />
        </View>
        <Pressable
          style={[styles.round, favOnly && styles.roundOn]}
          onPress={() => setFavOnly((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: favOnly }}
          accessibilityLabel="Show favourites only">
          <Icon name="star" color={favOnly ? colors.textOnGold : colors.textPrimary} filled={favOnly} size={22} />
        </Pressable>
      </View>

      <Pressable onPress={() => setSwitcher(true)} style={styles.portfolioName} accessibilityRole="button" accessibilityHint="Switch or create a portfolio">
        <Text style={styles.portfolioLabel}>
          Portfolio: <Text style={styles.portfolioGold}>{portfolio?.name ?? 'Main'}</Text>
        </Text>
        <Icon name="chevron" color={colors.textTertiary} size={16} />
      </Pressable>

      <View style={styles.totalRow}>
        <TotalValue byCurrency={t.byCurrency} hidden={hidden} style={styles.total} align="center" />
        <Pressable onPress={() => setHidden((v) => !v)} style={styles.eye} accessibilityRole="button" accessibilityLabel={hidden ? 'Show total value' : 'Hide total value'}>
          <Icon name={hidden ? 'eyeOff' : 'eye'} color={colors.textSecondary} size={20} />
        </Pressable>
      </View>
      <Text style={styles.totalNote}>
        {t.copies === 0
          ? 'No cards yet'
          : `${t.copies} card${t.copies === 1 ? '' : 's'}${t.unpricedCopies ? ` · ${t.unpricedCopies} without a price, not counted` : ''}`}
      </Text>

      <View style={styles.actions}>
        <Action icon="select" label={selecting ? 'Done' : 'Select'} active={selecting} onPress={() => (selecting ? endSelecting() : setSelecting(true))} />
        <Action icon="share" label="Export" onPress={exportCsv} />
        <Action icon="chevron" label={sort === 'value' ? 'By value' : 'Newest'} onPress={() => setSort((s) => (s === 'value' ? 'recent' : 'value'))} />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EntryTile entry={item} selecting={selecting} selected={selected.has(item.id)} onPress={onTile} />
        )}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.goldText} />}
        ListEmptyComponent={
          all.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState title="Your portfolio is empty" body="Add cards with the + button in Search or the steppers on a card's page." />
              <Pressable style={styles.cta} onPress={() => router.navigate('/search')} accessibilityRole="button">
                <Text style={styles.ctaText}>Find cards</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState title="No cards match" body={favOnly ? 'No favourites match this search.' : `Nothing matches “${filter}”.`} />
          )
        }
      />

      {selecting ? (
        <View style={[styles.bulkBar, { paddingBottom: space.md }]}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          {others.length > 0 && selected.size > 0 ? (
            <Pressable
              style={styles.bulkButton}
              onPress={() => {
                // Move to the next portfolio; the switcher picks which one is active.
                update.mutate((s) => moveEntries(s, [...selected], others[0].id));
                setNotice(`Moved to ${others[0].name}.`);
                endSelecting();
              }}
              accessibilityRole="button">
              <Text style={styles.bulkText}>Move to {others[0].name}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.bulkButton, styles.bulkDanger, selected.size === 0 && styles.bulkOff]}
            disabled={selected.size === 0}
            onPress={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              update.mutate((s) => removeEntries(s, [...selected]));
              setNotice(`Removed ${selected.size} card${selected.size === 1 ? '' : 's'}.`);
              endSelecting();
            }}
            accessibilityRole="button">
            <Icon name="trash" color={colors.down} size={18} />
            <Text style={[styles.bulkText, { color: colors.down }]}>{confirmDelete ? 'Tap again to remove' : 'Remove'}</Text>
          </Pressable>
        </View>
      ) : null}

      <PortfolioSwitcher state={state} visible={switcher} onClose={() => setSwitcher(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 3, gap: space.md },
  column: { gap: space.md },
  header: { gap: space.sm, paddingBottom: space.md },
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary, height: '100%' },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  portfolioName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: space.md, minHeight: 32 },
  portfolioLabel: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  portfolioGold: { color: colors.goldText },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  total: { fontSize: 34, lineHeight: 42, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'], textAlign: 'center', flexShrink: 1 },
  eye: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  totalNote: { ...type.cardMeta, color: colors.textTertiary, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.xl, marginTop: space.md },
  action: { alignItems: 'center', gap: 6, minWidth: 64 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionIconOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  actionLabel: { ...type.caption, color: colors.goldText },
  notice: { ...type.cardMeta, color: colors.textSecondary, textAlign: 'center', marginTop: space.sm },
  tile: {
    flex: 1,
    maxWidth: '50%',
    padding: space.sm + 2,
    gap: 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileSelected: { borderColor: colors.gold400, borderWidth: 2 },
  art: { width: '100%', aspectRatio: 63 / 88, borderRadius: 6, marginBottom: 6 },
  artEmpty: { backgroundColor: colors.raised },
  checkbox: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    backgroundColor: 'rgba(3,18,41,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  condition: { fontSize: 13, lineHeight: 17, color: colors.textSecondary },
  conditionGood: { color: colors.up },
  conditionGraded: { color: colors.goldText, fontWeight: '700' },
  tileFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: space.sm,
    marginTop: 'auto',
    paddingTop: 4,
  },
  qty: { ...type.caption, color: colors.textTertiary },
  value: { fontSize: 16, fontWeight: '700', color: colors.price, fontVariant: ['tabular-nums'] },
  emptyWrap: { alignItems: 'center' },
  cta: { backgroundColor: colors.gold400, borderRadius: radius.card, paddingHorizontal: space.xl, minHeight: 48, justifyContent: 'center' },
  ctaText: { fontWeight: '700', fontSize: 16, color: colors.textOnGold },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bgBottom,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bulkCount: { flex: 1, ...type.cardTitle, color: colors.textPrimary },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulkDanger: { borderColor: colors.down },
  bulkOff: { opacity: 0.4 },
  bulkText: { fontWeight: '600', color: colors.textPrimary },
  pressed: { opacity: 0.85 },
});

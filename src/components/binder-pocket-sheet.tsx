/** Sheet for one binder pocket: pick another match, search by hand, choose the printing, or skip. */
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OcrDebugPanel } from '@/components/ocr-debug-panel';
import { useCard, useCardSearch } from '@/hooks/use-cards';
import { pocketLabel } from '@/services/binder-grid.model';
import { canAdd, type ReviewPocket } from '@/services/binder-review.model';
import { formatMoney, printingsFor } from '@/services/printings.service';
import { cardImageUrl } from '@/services/tcgdex.service';
import { colors, radius, space, type } from '@/theme/tokens';
import type { CardBrief } from '@/types/card';

function CardRow({ card, on, onPress }: { card: CardBrief; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.row, on && styles.rowOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}>
      {card.image ? (
        <Image source={{ uri: cardImageUrl(card.image, 'low') }} style={styles.thumb} contentFit="contain" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {card.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          #{card.localId} · {card.id}
        </Text>
      </View>
    </Pressable>
  );
}

export function PocketSheet({
  pocket,
  onClose,
  onChooseCard,
  onChoosePrinting,
  onSkip,
}: {
  pocket: ReviewPocket | null;
  onClose: () => void;
  onChooseCard: (card: CardBrief) => void;
  onChoosePrinting: (printingId: string) => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const search = useCardSearch(query);
  const card = useCard(pocket?.cardId);
  const printings = useMemo(() => (card.data ? printingsFor(card.data) : []), [card.data]);
  if (!pocket) return null;

  const results = (search.data ?? []).slice(0, 12);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              {pocketLabel(pocket)}
            </Text>
            <Image source={{ uri: pocket.uri }} style={styles.photo} contentFit="contain" />
            {__DEV__ ? <OcrDebugPanel rawLines={pocket.lines} /> : null}

            {pocket.candidates.length > 0 ? (
              <>
                <Text style={styles.label}>Which card is it?</Text>
                {pocket.candidates.map((c) => (
                  <CardRow key={c.id} card={c} on={c.id === pocket.cardId} onPress={() => onChooseCard(c)} />
                ))}
              </>
            ) : (
              <Text style={styles.hint}>Nothing matched this pocket. Search for the card below.</Text>
            )}

            {canAdd(pocket) && printings.length > 1 ? (
              <>
                <Text style={styles.label}>Printing</Text>
                <View style={styles.chips}>
                  {printings.map((p) => {
                    const on = (pocket.printingId ?? printings.find((x) => x.prices.length)?.id ?? printings[0].id) === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => onChoosePrinting(p.id)}
                        style={[styles.chip, on && styles.chipOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>
                          {p.label}
                          {p.prices[0] ? ` · ${formatMoney(p.prices[0].amount, p.prices[0].currency)}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>Search by name</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => setQuery(text.trim())}
              returnKeyType="search"
              placeholder="Card name, then press search"
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
              accessibilityLabel="Search for the card"
            />
            {results.map((c) => (
              <CardRow key={c.id} card={c} on={c.id === pocket.cardId} onPress={() => onChooseCard(c)} />
            ))}
            {query.length >= 3 && !search.isFetching && results.length === 0 ? (
              <Text style={styles.hint}>No cards found for “{query}”.</Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.skip]} onPress={() => { onSkip(); onClose(); }} accessibilityRole="button">
              <Text style={styles.skipText}>Skip this pocket</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.done]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.bgBottom, borderWidth: 1, borderColor: colors.border },
  body: { padding: space.lg, gap: space.sm },
  title: { ...type.section, color: colors.textPrimary },
  photo: { width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.raised },
  label: { ...type.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space.md },
  hint: { ...type.body, color: colors.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowOn: { borderColor: colors.gold400, borderWidth: 2 },
  thumb: { width: 44, height: 62, borderRadius: 4 },
  thumbEmpty: { backgroundColor: colors.raised },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, fontSize: 13, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.gold400, borderColor: colors.gold300 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.textOnGold },
  input: { height: 48, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontSize: 16 },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  button: { flex: 1, minHeight: 50, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  skip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  skipText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  done: { backgroundColor: colors.gold400 },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.textOnGold },
});

/** Sheet to pick the active portfolio or create a new one. */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { useUpdateCollection } from '@/hooks/use-collection';
import {
  createPortfolio,
  entriesIn,
  setActivePortfolio,
  type CollectionState,
} from '@/services/collection.model';
import { colors, radius, space, type } from '@/theme/tokens';

export function PortfolioSwitcher({
  state,
  visible,
  onClose,
}: {
  state: CollectionState;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const update = useUpdateCollection();
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    update.mutate((s) => createPortfolio(s, name));
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} onPress={() => undefined}>
          <Text style={styles.title} accessibilityRole="header">
            Portfolios
          </Text>
          {state.portfolios.map((p) => {
            const on = p.id === state.activePortfolioId;
            const copies = entriesIn(state, p.id).reduce((n, e) => n + e.quantity, 0);
            return (
              <Pressable
                key={p.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => {
                  update.mutate((s) => setActivePortfolio(s, p.id));
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.meta}>{copies === 1 ? '1 card' : `${copies} cards`}</Text>
                </View>
                {on ? <Icon name="check" color={colors.goldText} size={22} /> : null}
              </Pressable>
            );
          })}
          <View style={styles.newRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="New portfolio name, e.g. For Trade"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={create}
              returnKeyType="done"
              maxLength={40}
              accessibilityLabel="New portfolio name"
            />
            <Pressable
              style={[styles.create, !name.trim() && styles.createOff]}
              onPress={create}
              disabled={!name.trim()}
              accessibilityRole="button">
              <Text style={styles.createText}>Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    gap: space.sm,
    padding: space.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.bgBottom,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...type.section, color: colors.textPrimary, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.gold400 },
  rowText: { flex: 1, gap: 2 },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { ...type.cardMeta, color: colors.textSecondary },
  newRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
  },
  create: { paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: colors.gold400, justifyContent: 'center' },
  createOff: { opacity: 0.45 },
  createText: { fontWeight: '700', color: colors.textOnGold },
});

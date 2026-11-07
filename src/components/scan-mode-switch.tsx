/** "Card | Binder page" switch shown at the top of both scan screens. */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

export function ScanModeSwitch({ mode, disabled = false }: { mode: 'card' | 'binder'; disabled?: boolean }) {
  const router = useRouter();
  const item = (id: 'card' | 'binder', label: string) => {
    const on = id === mode;
    return (
      <Pressable
        key={id}
        disabled={disabled || on}
        onPress={() => router.replace(id === 'card' ? '/scan' : '/binder-scan')}
        style={[styles.item, on && styles.itemOn]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on, disabled }}>
        <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {item('card', 'Card')}
      {item('binder', 'Binder page')}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(3, 18, 41, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  item: { minHeight: 36, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center' },
  itemOn: { backgroundColor: colors.gold400 },
  text: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  textOn: { color: colors.textOnGold },
});

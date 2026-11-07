/** A portfolio total in the user's display currency, with the rate it used. */
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { useDisplayTotals } from '@/hooks/use-history';
import { formatMoney, formatTotals } from '@/services/printings.service';
import { colors } from '@/theme/tokens';

/** "$5,870.01" or, without a rate, "$1,974.26 + €3,489.25". */
export function useTotalText(byCurrency: Record<string, number>) {
  const t = useDisplayTotals(byCurrency);
  const parts: string[] = [];
  if (t.amount !== undefined) parts.push(formatMoney(t.amount, t.currency));
  const rest = formatTotals(t.rest);
  if (Object.keys(t.rest).length) parts.push(rest);
  const text = parts.length ? parts.join(' + ') : formatTotals({});
  const rateNote =
    t.usedRate && t.fx
      ? `${t.currency === 'EUR' ? 'USD' : 'EUR'} prices converted at €1 = $${t.fx.eurUsd.toFixed(4)} (ECB, ${t.fx.date})`
      : t.target !== 'original' && Object.keys(t.rest).length
        ? 'Exchange rate unavailable, so currencies are shown separately'
        : undefined;
  return { text, rateNote };
}

export function TotalValue({
  byCurrency,
  hidden = false,
  style,
  showNote = true,
  align = 'flex-start',
}: {
  byCurrency: Record<string, number>;
  hidden?: boolean;
  style?: TextStyle;
  showNote?: boolean;
  align?: 'flex-start' | 'center';
}) {
  const { text, rateNote } = useTotalText(byCurrency);
  return (
    <View style={[styles.wrap, { alignItems: align }]}>
      <Text style={style} accessibilityLabel={hidden ? 'Total value hidden' : `Total value ${text}`}>
        {hidden ? '••••••' : text}
      </Text>
      {showNote && rateNote && !hidden ? (
        <Text style={[styles.note, { textAlign: align === 'center' ? 'center' : 'left' }]}>{rateNote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, flexShrink: 1 },
  note: { fontSize: 12, lineHeight: 16, color: colors.textTertiary },
});

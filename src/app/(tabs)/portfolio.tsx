import { ScrollView, StyleSheet } from 'react-native';

import { EmptyState, ScreenTitle } from '@/components/screen';
import { colors, space } from '@/theme/tokens';

/** Portfolio arrives in build step 4 (P5); until then say so plainly. */
export default function PortfolioScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle>Portfolio</ScreenTitle>
      <EmptyState
        title="Your portfolio is coming soon"
        body="You’ll be able to add cards from Card Details and Search, set quantities, and see the total value here."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg },
});

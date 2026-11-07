import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { colors } from '@/theme/tokens';

function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const tint = typeof color === 'string' ? color : focused ? colors.tabActive : colors.tabInactive;
    return <Icon name={name} color={tint} size={24} filled={focused && name !== 'search'} />;
  };
}

/** Centre button: opens the camera above the tabs instead of switching tab. */
function ScanTabButton() {
  const router = useRouter();
  return (
    <View style={styles.scanSlot}>
      <Pressable
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Scan a card">
        <Icon name="camera" color={colors.textOnGold} size={28} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        // Fixed height so 12 pt labels are never clipped; the home indicator gets its own inset.
        tabBarStyle: [
          styles.tabBar,
          { height: 64 + Math.max(insets.bottom, 8), paddingTop: 4, paddingBottom: Math.max(insets.bottom, 8) },
        ],
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.label,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen
        name="scan-tab"
        options={{ title: 'Scan', tabBarButton: () => <ScanTabButton /> }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: 'Portfolio', tabBarIcon: tabIcon('portfolio') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  scanSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -22,
    backgroundColor: colors.gold400,
    borderWidth: 1,
    borderColor: colors.gold300,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 16px ${colors.gold400}73`,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, ThemeProvider, Stack, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ensureCardIndex } from '@/services/card-index.service';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** PokeWorth is dark-only (design/home-spec.md §2.1), whatever the system theme. */
const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.goldText,
    background: colors.bg,
    card: colors.bgTop,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function RootLayout() {
  // Load the on-device card index (refreshing it in the background when it is old or
  // missing), so scans match on the phone. Scanning works without it.
  useEffect(() => {
    void ensureCardIndex();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <Stack>
          {/* Tabs draw their own headers; the flows below open above the tabs. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'PokeWorth' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Card', headerShown: false }} />
          <Stack.Screen name="binder-scan" options={{ title: 'Scan Binder Page', headerShown: false }} />
          <Stack.Screen name="binder-read" options={{ title: 'Binder Page' }} />
          <Stack.Screen name="manual-entry" options={{ title: 'Enter Card Details' }} />
          <Stack.Screen name="confirm" options={{ title: 'Confirm Card' }} />
          <Stack.Screen name="scan-log" options={{ title: 'Scan log' }} />
          <Stack.Screen name="lists"options={{ title: 'Trade & Want lists' }} />
          <Stack.Screen name="sets" options={{ title: 'Sets' }} />
          <Stack.Screen name="sets/[id]" options={{ title: 'Set' }} />
          <Stack.Screen
            name="result"
            options={{
              // The artwork runs under a see-through header; only the back button shows.
              title: 'Card Details',
              headerTransparent: true,
              headerTitle: '',
              headerShadowVisible: false,
              headerTintColor: colors.textPrimary,
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

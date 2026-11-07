import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, ThemeProvider, Stack, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

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
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <Stack>
          {/* Tabs draw their own headers; the flows below open above the tabs. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'PokeWorth' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Card', headerShown: false }} />
          <Stack.Screen name="manual-entry" options={{ title: 'Enter Card Details' }} />
          <Stack.Screen name="confirm" options={{ title: 'Confirm Card' }} />
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

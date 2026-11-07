/**
 * Design tokens from design/home-spec.md §2. PokeWorth is dark-only: tab
 * screens use these values whatever the system theme is.
 */

export const colors = {
  bgTop: '#001643',
  bg: '#031229',
  bgBottom: '#0C1C33',
  surface: '#0A1A30',
  surfaceRow: '#05162B',
  raised: '#12243B',
  border: '#1E3150',
  gold300: '#FDDF6F',
  gold400: '#FDCB56',
  gold500: '#FEBD3D',
  goldText: '#FEDF4E',
  price: '#FEE144',
  textPrimary: '#FEFEFE',
  textSecondary: '#CDD9EC',
  textTertiary: '#A9B9D3',
  textOnGold: '#0B0B0D',
  tabInactive: '#B0C0DA',
  tabActive: '#FEE544',
  tabBar: 'rgba(13, 29, 52, 0.94)',
  up: '#5FD3A8',
  down: '#F07C6C',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { thumb: 4, tile: 8, card: 12, cta: 14, pill: 999 } as const;

export const type = {
  wordmark: { fontSize: 32, lineHeight: 36, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
  button: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  section: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  cardTitle: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  cardMeta: { fontSize: 14, lineHeight: 18, fontWeight: '400' },
  price: { fontSize: 18, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 16, fontWeight: '500' },
} as const;

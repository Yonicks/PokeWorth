/** C4: Card Details. Price rows show provider, currency and date; no price says so; printing chosen first. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import ResultScreen from '@/app/result';
import { ApiError } from '@/services/api-error';
import type { Card } from '@/types/card';

let mockCard: Record<string, unknown> = {};

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'base1-4' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/use-cards', () => ({ useCard: () => mockCard }));
jest.mock('@/hooks/use-collection', () => ({
  useCollection: () => ({ data: { favorites: [] } }),
  useUpdateCollection: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/hooks/use-history', () => ({
  useHistory: () => ({ data: undefined }),
  useRecordCard: jest.fn(),
}));
jest.mock('@/services/scan-log.service', () => ({
  getScanEntry: jest.fn(() => Promise.resolve(undefined)),
  updateScanLog: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/storage.service', () => ({ addRecentScan: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/add-to-portfolio', () => ({ AddToPortfolio: () => null }));
jest.mock('@/components/price-chart', () => ({ PriceChart: () => null }));

const pricedCard: Card = {
  id: 'base1-4',
  localId: '4',
  name: 'Charizard',
  set: { id: 'base1', name: 'Base Set', cardCount: { official: 102, total: 102 } },
  variants_detailed: [
    {
      type: 'holo',
      subtype: 'unlimited',
      variantId: 'unl',
      pricing: {
        cardmarket: { unit: 'EUR', updated: '2026-11-07T10:30:45.658Z', trend: 353.78 },
        tcgplayer: { unit: 'USD', updated: '2026-11-07T10:30:45.539Z', holofoil: { marketPrice: 987.13 } },
      },
    },
    {
      type: 'holo',
      subtype: 'shadowless',
      stamp: ['1st-edition'],
      variantId: '1st',
      pricing: { cardmarket: { unit: 'EUR', updated: '2026-11-07T10:30:45.658Z', trend: 3489.25 }, tcgplayer: null },
    },
  ],
} as Card;

const unpricedCard: Card = {
  id: 'base1-4',
  localId: '4',
  name: 'Charizard',
  set: { id: 'base1', name: 'Base Set', cardCount: { official: 102, total: 102 } },
  variants_detailed: [{ type: 'holo', subtype: 'unlimited', variantId: 'unl' }],
} as Card;

const loaded = (data: Card) => ({ isLoading: false, isError: false, data, refetch: jest.fn() });

describe('Result screen', () => {
  it('shows a loading state', async () => {
    mockCard = { isLoading: true, isError: false, data: undefined, refetch: jest.fn() };
    await render(<ResultScreen />);
    expect(screen.getByText('Loading card…')).toBeTruthy();
  });

  it('shows a typed error and Retry refetches', async () => {
    const refetch = jest.fn();
    mockCard = { isLoading: false, isError: true, error: new ApiError('offline', 'x'), data: undefined, refetch };
    await render(<ResultScreen />);
    expect(screen.getByText(/offline/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows each price with provider, currency and date', async () => {
    mockCard = loaded(pricedCard);
    await render(<ResultScreen />);
    expect(screen.getByText(/TCGplayer market price · USD · 2026-11-07/)).toBeTruthy();
    expect(screen.getByText('Cardmarket')).toBeTruthy();
    expect(screen.getByText(/Trend price · EUR · 2026-11-07/)).toBeTruthy();
    expect(screen.queryByText('No price available')).toBeNull();
  });

  it('shows the printing chips and switches the price to the chosen printing', async () => {
    mockCard = loaded(pricedCard);
    await render(<ResultScreen />);
    expect(screen.getByText(/TCGplayer market price/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/1st Edition/));
    expect(screen.getByText(/Cardmarket trend price · EUR · 2026-11-07/)).toBeTruthy();
    expect(screen.queryByText(/TCGplayer market price/)).toBeNull();
  });

  it('says there is no price instead of showing a number', async () => {
    mockCard = loaded(unpricedCard);
    await render(<ResultScreen />);
    expect(screen.getByText('No price available')).toBeTruthy();
    expect(screen.queryByText(/Worth /)).toBeNull();
  });
});

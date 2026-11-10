/** C3: Confirm screen. No auto-advance unless confident; manual-entry fallback; typed errors. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import ConfirmScreen from '@/app/confirm';
import { ApiError } from '@/services/api-error';
import type { ScoredCandidate } from '@/types/card';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
let mockMatch: Record<string, unknown> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock('@/hooks/use-cards', () => ({
  useCardMatch: () => mockMatch,
  useSetNames: () => ({ data: new Map([['base1', 'Base Set']]) }),
}));
jest.mock('@/components/price-tag', () => ({ PriceTag: () => null }));
jest.mock('@/services/scan-log.service', () => ({ updateScanLog: jest.fn(() => Promise.resolve()) }));

const cand = (id: string, name: string, score: number): ScoredCandidate => ({
  card: { id, localId: '4', name },
  score,
  reasons: ['name exact'],
});
const parsed = { name: 'Charizard', localId: '4', setTotal: 102, rawLines: [] };

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockParams = { name: 'Charizard', number: '4', total: '102' };
  mockMatch = { isLoading: false, isError: false, data: { parsed, candidates: [], confidentCardId: undefined }, refetch: jest.fn() };
});

describe('Confirm screen', () => {
  it('offers manual entry when there is nothing to search for', async () => {
    mockParams = {};
    await render(<ConfirmScreen />);
    expect(screen.getByText(/Nothing to search for/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Enter details manually'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/manual-entry' }));
  });

  it('shows a searching state while matching', async () => {
    mockMatch = { isLoading: true, isError: false, data: undefined, refetch: jest.fn() };
    await render(<ConfirmScreen />);
    expect(screen.getByText('Searching the card catalog…')).toBeTruthy();
  });

  it('shows the cause of a failure and Retry refetches', async () => {
    const refetch = jest.fn();
    mockMatch = { isLoading: false, isError: true, error: new ApiError('timeout', 'x'), data: undefined, refetch };
    await render(<ConfirmScreen />);
    expect(screen.getByText(/too long/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('skips straight to the card when the match is confident', async () => {
    mockMatch = {
      isLoading: false,
      isError: false,
      data: { parsed, candidates: [cand('base1-4', 'Charizard', 1)], confidentCardId: 'base1-4' },
      refetch: jest.fn(),
    };
    await render(<ConfirmScreen />);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/result', params: { id: 'base1-4' } });
  });

  it('does not auto-advance when not confident, and lets the user pick', async () => {
    mockMatch = {
      isLoading: false,
      isError: false,
      data: { parsed, candidates: [cand('base1-4', 'Charizard', 0.9), cand('base4-4', 'Charizard', 0.9)], confidentCardId: undefined },
      refetch: jest.fn(),
    };
    await render(<ConfirmScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getAllByText('Charizard')).toHaveLength(2);
    await fireEvent.press(screen.getByText(/base4-4/));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/result', params: { id: 'base4-4' } });
  });

  it('shows the set name, not the card id (AC-P2.1)', async () => {
    mockMatch = {
      isLoading: false,
      isError: false,
      data: { parsed, candidates: [cand('base1-4', 'Charizard', 0.9), cand('base4-4', 'Charizard', 0.9)], confidentCardId: undefined },
      refetch: jest.fn(),
    };
    await render(<ConfirmScreen />);
    expect(screen.getByText('#4 · Base Set')).toBeTruthy();
    expect(screen.queryByText(/base1-4/)).toBeNull();
  });

  it('shows at most five leading candidates and folds the rest (AC-P2.1)', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => cand(`x${s}-4`, `Pikachu ${s}`, 0.9));
    mockMatch = { isLoading: false, isError: false, data: { parsed, candidates: many, confidentCardId: undefined }, refetch: jest.fn() };
    await render(<ConfirmScreen />);
    expect(screen.getAllByText(/^Pikachu /)).toHaveLength(5);
    await fireEvent.press(screen.getByText('Show 2 other printings'));
    expect(screen.getAllByText(/^Pikachu /)).toHaveLength(7);
  });

  it('hides weaker printings until asked', async () => {
    mockMatch = {
      isLoading: false,
      isError: false,
      data: { parsed, candidates: [cand('a', 'Charizard', 0.95), cand('b', 'Charmeleon', 0.5)], confidentCardId: undefined },
      refetch: jest.fn(),
    };
    await render(<ConfirmScreen />);
    expect(screen.queryByText('Charmeleon')).toBeNull();
    await fireEvent.press(screen.getByText('Show 1 other printing'));
    expect(screen.getByText('Charmeleon')).toBeTruthy();
  });

  it('offers manual entry when no card matches', async () => {
    await render(<ConfirmScreen />);
    expect(screen.getByText(/No matching cards found/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Enter details manually'));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/manual-entry', params: expect.objectContaining({ name: 'Charizard' }) }),
    );
  });
});

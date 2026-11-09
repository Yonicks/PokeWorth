/** C5 (display part): the portfolio total text, hidden state and rate note. */
import { render, screen } from '@testing-library/react-native';

import { TotalValue } from '@/components/total-value';

jest.mock('@/hooks/use-history', () => ({
  useDisplayTotals: jest.fn(),
}));
import { useDisplayTotals } from '@/hooks/use-history';

const mocked = useDisplayTotals as jest.Mock;

describe('TotalValue', () => {
  it('shows the converted total and the exchange-rate note', async () => {
    mocked.mockReturnValue({
      amount: 100,
      currency: 'USD',
      rest: {},
      usedRate: true,
      fx: { eurUsd: 1.1165, date: '2026-11-06' },
      target: 'USD',
    });
    await render(<TotalValue byCurrency={{ USD: 50, EUR: 45 }} />);
    expect(screen.getByLabelText(/Total value \$100/)).toBeTruthy();
    expect(screen.getByText(/converted at €1 = \$1\.1165 \(ECB, 2026-11-06\)/)).toBeTruthy();
  });

  it('hides the amount and the note when hidden', async () => {
    mocked.mockReturnValue({ amount: 100, currency: 'USD', rest: {}, usedRate: true, fx: { eurUsd: 1.1, date: 'd' }, target: 'USD' });
    await render(<TotalValue byCurrency={{ USD: 100 }} hidden />);
    expect(screen.getByLabelText('Total value hidden')).toBeTruthy();
    expect(screen.queryByText(/converted at/)).toBeNull();
  });

  it('says currencies are shown separately when no rate is available', async () => {
    mocked.mockReturnValue({ amount: undefined, currency: 'USD', rest: { USD: 50, EUR: 45 }, usedRate: false, fx: undefined, target: 'USD' });
    await render(<TotalValue byCurrency={{ USD: 50, EUR: 45 }} />);
    expect(screen.getByText(/Exchange rate unavailable/)).toBeTruthy();
  });
});

/** C1-C4 (shared parts): loading, empty and error states with Retry. Offline, no network. */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/screen';
import { ApiError } from '@/services/api-error';

describe('LoadingState', () => {
  it('shows its label and announces a progress bar', async () => {
    await render(<LoadingState label="Loading card…" />);
    expect(screen.getByText('Loading card…')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('shows a title and body', async () => {
    await render(<EmptyState title="No cards found" body="Check the spelling." />);
    expect(screen.getByText('No cards found')).toBeTruthy();
    expect(screen.getByText('Check the spelling.')).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('says the cause and calls onRetry when Retry is pressed', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState title="Search failed" error={new ApiError('offline', 'x')} onRetry={onRetry} />);
    expect(screen.getByText('Search failed')).toBeTruthy();
    expect(screen.getByText(/offline/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('names the missing item and hides Retry for a not-found error', async () => {
    await render(<ErrorState error={new ApiError('not-found', 'x', 404)} subject="this card" onRetry={jest.fn()} />);
    expect(screen.getByText('Could not find this card.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('never shows the raw technical message', async () => {
    await render(<ErrorState error={new ApiError('server', 'TCGdex request failed (503) for /cards/x', 503)} onRetry={jest.fn()} />);
    expect(screen.queryByText(/503/)).toBeNull();
  });

  it('has no Retry button when no handler is given', async () => {
    await render(<ErrorState error={new Error('boom')} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy();
  });
});

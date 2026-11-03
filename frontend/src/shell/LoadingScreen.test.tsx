import { act, screen } from '@testing-library/react-native';

import { renderUi } from '@/test/renderUi';

import { LoadingScreen, SLOW_AFTER_MS } from './LoadingScreen';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const HINT = 'Still waiting for the server.';

async function pass(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('LoadingScreen', () => {
  it('names what it is waiting for, as busy', async () => {
    await renderUi(<LoadingScreen label="Opening your account" />);

    const busy = screen.getByLabelText('Opening your account');
    expect(busy.props['aria-busy']).toBe(true);
  });

  it('says nothing more at first, and has a live region ready for what it will say', async () => {
    await renderUi(<LoadingScreen slowHint={HINT} />);

    expect(screen.queryByText(HINT)).toBeNull();
    const region = screen.getByTestId('slow-hint');
    expect(region.props.role).toBe('status');
    expect(region.props.accessibilityLiveRegion).toBe('polite');
  });

  it('says that the wait is long once it is, in the region that was already there', async () => {
    await renderUi(<LoadingScreen slowHint={HINT} />);

    await pass(SLOW_AFTER_MS - 1);
    expect(screen.queryByText(HINT)).toBeNull();

    await pass(1);
    expect(screen.getByText(HINT)).toBeOnTheScreen();
    expect(screen.getByTestId('slow-hint')).toContainElement(screen.getByText(HINT));
  });

  it('keeps the hint out of the label of the busy region, which would otherwise swallow it', async () => {
    await renderUi(<LoadingScreen label="Opening your account" slowHint={HINT} />);
    await pass(SLOW_AFTER_MS);

    expect(screen.getByLabelText('Opening your account')).not.toContainElement(
      screen.getByText(HINT),
    );
  });

  it('stays as it is without a hint, however long it takes', async () => {
    await renderUi(<LoadingScreen />);

    await pass(10 * SLOW_AFTER_MS);

    expect(screen.getByTestId('slow-hint').children).toHaveLength(0);
    expect(screen.getByLabelText('Loading Portfolio Signals')).toBeOnTheScreen();
  });
});

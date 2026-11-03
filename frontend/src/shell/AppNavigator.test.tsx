import { act, render, screen } from '@testing-library/react-native';

import { AuthProvider, type AuthController, type AuthState } from '@/auth';
import { Providers } from '@/test/renderUi';

import { AppNavigator } from './AppNavigator';
import { SLOW_AFTER_MS } from './LoadingScreen';
import { useBoot, type Boot } from './useBoot';

jest.mock('./useBoot');

const useBootMock = jest.mocked(useBoot);

const SIGNED_IN: AuthState = { status: 'signedIn', suggestedProfile: null, expired: false };

const controller: AuthController = {
  mode: 'mock',
  hooks: { getAuthHeaders: async () => ({}) },
  getState: () => SIGNED_IN,
  subscribe: () => () => undefined,
  restore: async () => undefined,
  signIn: async () => undefined,
  signOut: async () => undefined,
  expire: () => undefined,
};

function boot(phase: Boot['phase']) {
  useBootMock.mockReturnValue({ phase, error: null, retry: jest.fn() });
}

async function renderNavigator() {
  const onReady = jest.fn();
  await render(
    <Providers>
      <AuthProvider controller={controller}>
        <AppNavigator fontsReady onReady={onReady} />
      </AuthProvider>
    </Providers>,
  );
  return { onReady };
}

async function pass(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('while the account is being opened', () => {
  it('says so, and says when the server is slow to answer', async () => {
    boot('opening-account');
    const { onReady } = await renderNavigator();

    expect(screen.getByLabelText('Opening your account')).toBeOnTheScreen();
    expect(screen.queryByText(/^Still waiting for the server\./)).toBeNull();

    await pass(SLOW_AFTER_MS);

    expect(
      screen.getByText(
        'Still waiting for the server. If it has been idle, it can take a little while to start.',
      ),
    ).toBeOnTheScreen();
    // The app has a screen of its own to show by now, so the native splash screen makes way for it.
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('while the session is being restored', () => {
  it('shows the plain loading screen, which has no server to blame yet, behind the splash screen', async () => {
    boot('booting');
    const { onReady } = await renderNavigator();

    await pass(10 * SLOW_AFTER_MS);

    expect(screen.getByLabelText('Loading Portfolio Signals')).toBeOnTheScreen();
    expect(screen.queryByText(/^Still waiting for the server\./)).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
  });
});

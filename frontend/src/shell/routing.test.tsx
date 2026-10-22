import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';

import { resetMockBackend } from '@/mocks/mockFetch';
import { PREFERENCES_KEY } from '@/lib/preferences';

jest.mock('@/ui/useAppFonts', () => ({ useAppFonts: () => true }));

process.env.EXPO_PUBLIC_API_MODE = 'mock';
process.env.EXPO_PUBLIC_MOCK_SCENARIO = 'happy';

// The first render loads the whole route tree.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

beforeEach(async () => {
  resetMockBackend('happy');
  await AsyncStorage.clear();
});

async function openDemo() {
  const open = await screen.findByRole('button', { name: 'Open the demo' }, LONG);
  await fireEvent.press(open);
  await screen.findByRole('tab', { name: 'Overview' }, LONG);
}

describe('route guards', () => {
  it('sends a signed-out visitor who opens a deep link to the sign-in screen', async () => {
    const app = await renderRouter('./src/app', { initialUrl: '/holdings' });

    await screen.findByRole('button', { name: 'Open the demo' }, LONG);

    expect(app.getPathname()).toBe('/sign-in');
    expect(screen.queryByRole('tab', { name: 'Holdings' })).toBeNull();
  });

  it('says what the demo is before anyone opens it', async () => {
    await renderRouter('./src/app');

    await screen.findByRole('button', { name: 'Open the demo' }, LONG);

    expect(screen.getByText(/fictional companies and invented figures/)).toBeOnTheScreen();
    expect(screen.getByText('Informational only. Not investment advice.')).toBeOnTheScreen();
  });

  it('opens the app for a registered person and keeps the sign-in screen out of reach', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    expect(app.getPathname()).toBe('/');

    await testRouter.navigate('/sign-in').catch(() => undefined);
    await waitFor(() => expect(app.getPathname()).toBe('/'), LONG);
    expect(screen.queryByRole('button', { name: 'Open the demo' })).toBeNull();
  });

  it('shows a page that does not exist as such, even when signed out', async () => {
    await renderRouter('./src/app', { initialUrl: '/nowhere' });

    await screen.findByText('This page does not exist', {}, LONG);

    expect(screen.getByText('Go to the start')).toBeOnTheScreen();
  });
});

describe('the app frame', () => {
  it('labels the demo on every screen and offers the five destinations', async () => {
    await renderRouter('./src/app');
    await openDemo();

    expect(
      screen.getByText(/Every company, holding and figure in this demo is fictional/),
    ).toBeOnTheScreen();
    for (const name of ['Overview', 'Holdings', 'Insights', 'Connections', 'Settings']) {
      expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeSelected();
  });

  it('moves between destinations and marks the current one', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    await fireEvent.press(screen.getByRole('tab', { name: 'Holdings' }));
    await waitFor(() => expect(app.getPathname()).toBe('/holdings'), LONG);
    expect(screen.getByRole('tab', { name: 'Holdings' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Overview' })).not.toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    await waitFor(() => expect(app.getPathname()).toBe('/settings'), LONG);
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeSelected();
  });

  it('keeps Holdings current while a single holding is open', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    await testRouter.navigate('/holdings/NWND');

    expect(app.getPathname()).toBe('/holdings/NWND');
    expect(screen.getByRole('tab', { name: 'Holdings' })).toBeSelected();
  });

  it('hides money amounts on request and remembers the choice', async () => {
    await renderRouter('./src/app');
    await openDemo();

    const hide = screen.getByRole('switch', { name: 'Hide amounts' });
    expect(hide).not.toBeChecked();

    await fireEvent.press(hide);

    expect(screen.getByRole('switch', { name: 'Hide amounts' })).toBeChecked();
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toEqual({
        hideAmounts: true,
      }),
    );
  });
});

import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { resetMockBackend } from '@/mocks/mockFetch';

jest.mock('@/ui/useAppFonts', () => ({ useAppFonts: () => true }));

// The "empty" demo has nobody registered yet, which is what a first sign-in looks like.
process.env.EXPO_PUBLIC_API_MODE = 'mock';
process.env.EXPO_PUBLIC_MOCK_SCENARIO = 'empty';

jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

beforeEach(() => {
  resetMockBackend('empty');
});

async function openDemo() {
  const open = await screen.findByRole('button', { name: 'Open the demo' }, LONG);
  await fireEvent.press(open);
  await screen.findByText('Set up your account', {}, LONG);
}

describe('first sign-in', () => {
  it('asks for a name and an e-mail address, filled in from the sign-in', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    expect(app.getPathname()).toBe('/profile');
    expect(screen.getByTestId('profile-display-name')).toHaveDisplayValue('Demo investor');
    expect(screen.getByTestId('profile-email')).toHaveDisplayValue('demo.investor@example.test');
    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull();
  });

  it('checks the details before it sends them', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    await fireEvent.changeText(screen.getByTestId('profile-email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText('Enter an e-mail address such as name@example.com.'),
    ).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/profile');
  });

  it('opens the app once the details are accepted', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), '  Ada Byron ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('tab', { name: 'Overview' }, LONG);
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByText('Set up your account')).toBeNull();
  });

  it('lets the person sign out instead', async () => {
    const app = await renderRouter('./src/app');
    await openDemo();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), LONG);
    expect(await screen.findByRole('button', { name: 'Open the demo' })).toBeOnTheScreen();
  });
});

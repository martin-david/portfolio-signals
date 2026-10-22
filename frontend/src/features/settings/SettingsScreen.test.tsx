import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { UserProfileDto } from '@/api/schema';
import { AuthProvider, type AuthController, type AuthState } from '@/auth';
import { PREFERENCES_KEY } from '@/lib/preferences';
import type { MockBackend } from '@/mocks/mockBackend';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';

import { planFacts } from './plan';
import { SettingsScreen } from './SettingsScreen';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

beforeEach(async () => {
  await AsyncStorage.clear();
});

const SIGNED_IN: AuthState = { status: 'signedIn', suggestedProfile: null, expired: false };

function fakeController(signOut: () => Promise<void> = async () => undefined): AuthController {
  return {
    mode: 'mock',
    hooks: { getAuthHeaders: async () => ({}) },
    getState: () => SIGNED_IN,
    subscribe: () => () => undefined,
    restore: async () => undefined,
    signIn: async () => undefined,
    signOut,
    expire: () => undefined,
  };
}

function screenWith(controller: AuthController) {
  return function SettingsWithAuth() {
    return (
      <AuthProvider controller={controller}>
        <SettingsScreen />
      </AuthProvider>
    );
  };
}

async function renderSettings(options: RoutedOptions & { controller?: AuthController } = {}) {
  const { controller = fakeController(), ...routed } = options;
  const rendered = await renderRouted(screenWith(controller), routed);
  await waitFor(() => expect(screen.queryByLabelText('Loading your account')).toBeNull(), LONG);
  return rendered;
}

async function currentMe(backend: MockBackend): Promise<UserProfileDto> {
  const response = await backend.fetch(
    new Request('https://mock.invalid/api/v1/me', { headers: { 'X-Dev-User': 'tester' } }),
  );
  return (await response.json()) as UserProfileDto;
}

describe('the account', () => {
  it('shows the name and e-mail address the API has, in a form', async () => {
    const { backend } = await renderSettings();
    const me = await currentMe(backend);

    expect(await screen.findByTestId('profile-display-name')).toHaveDisplayValue(me.displayName);
    expect(screen.getByTestId('profile-email')).toHaveDisplayValue(me.email);
    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your details' })).toBeOnTheScreen();
  });

  it('keeps Save off until something is edited', async () => {
    await renderSettings();

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), 'Ada Byron');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('saves the new name without the spaces around it, and says so', async () => {
    const { backend } = await renderSettings();
    await screen.findByTestId('profile-display-name');

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), '  Ada Byron ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Details saved.', {}, LONG)).toBeOnTheScreen();
    expect((await currentMe(backend)).displayName).toBe('Ada Byron');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('checks the e-mail address before it sends anything', async () => {
    const { backend } = await renderSettings();
    const before = await currentMe(backend);
    await screen.findByTestId('profile-email');

    await fireEvent.changeText(screen.getByTestId('profile-email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Enter an e-mail address such as name@example.com.'),
    ).toBeOnTheScreen();
    expect(await currentMe(backend)).toEqual(before);
  });
});

describe('the plan', () => {
  it('says what the plan gives, and that it cannot be changed here yet', async () => {
    const { backend } = await renderSettings();
    const facts = planFacts(await currentMe(backend));

    const items = within(await screen.findByTestId('plan')).getAllByRole('listitem');
    expect(items).toHaveLength(facts.length);
    facts.forEach((fact, index) => {
      expect(within(items[index]).getByText(fact.label)).toBeOnTheScreen();
      expect(within(items[index]).getByText(fact.value)).toBeOnTheScreen();
    });
    expect(facts.map((fact) => fact.label)).toEqual([
      'Plan',
      'eToro syncs',
      'TipRanks syncs',
      'Sync now',
      'Member since',
    ]);
    expect(screen.getByTestId('plan-note')).toHaveTextContent(
      /Changing plan is not possible in the app yet\./,
    );
  });

  it('reports a plan without manual syncs as it is', async () => {
    await renderSettings({
      intercept: async (request, forward) => {
        const response = await forward(request);
        if (request.url.endsWith('/api/v1/me') && request.method === 'GET') {
          return Response.json({ ...(await response.json()), allowsManualSync: false });
        }
        return response;
      },
    });

    expect(
      await within(await screen.findByTestId('plan')).findByText('Not included'),
    ).toBeOnTheScreen();
  });
});

describe('this device', () => {
  it('hides amounts on request and remembers the choice', async () => {
    await renderSettings();
    const toggle = await screen.findByRole('switch', { name: 'Hide amounts on this device' });
    expect(toggle).not.toBeChecked();

    await fireEvent.press(toggle);

    expect(screen.getByRole('switch', { name: 'Hide amounts on this device' })).toBeChecked();
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toEqual({
        hideAmounts: true,
      }),
    );
  });

  it('says what hiding does and does not cover', async () => {
    await renderSettings();

    expect(
      await screen.findByText(/Percentages and market prices stay visible\./),
    ).toBeOnTheScreen();
  });
});

describe('about and the way out', () => {
  it('leads to how verdicts are decided, and repeats that nothing here is advice', async () => {
    const { app } = await renderSettings();

    expect(await screen.findByTestId('disclaimer')).toHaveTextContent(/not investment advice/);
    await fireEvent.press(screen.getByRole('link', { name: 'How verdicts are decided' }));

    await waitFor(() => expect(app.getPathname()).toBe('/method'), LONG);
  });

  it('signs out', async () => {
    const signOut = jest.fn(async () => undefined);
    await renderSettings({ controller: fakeController(signOut) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('when the account cannot be had', () => {
  it('shows that it is loading', async () => {
    await renderRouted(screenWith(fakeController()), {
      intercept: (request, forward) =>
        request.url.endsWith('/api/v1/me') && request.method === 'GET'
          ? new Promise<Response>(() => undefined)
          : forward(request),
    });

    expect(await screen.findByLabelText('Loading your account')).toBeOnTheScreen();
  });

  it('says so and tries again on request, leaving the rest of the page usable', async () => {
    let down = true;
    await renderSettings({
      intercept: async (request, forward) =>
        down && request.url.endsWith('/api/v1/me') && request.method === 'GET'
          ? Response.json({ status: 500, title: 'Boom' }, { status: 500 })
          : forward(request),
    });

    expect(await screen.findByText("Couldn't load your account", {}, LONG)).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Hide amounts on this device' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeOnTheScreen();

    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('profile-display-name', {}, LONG)).toBeOnTheScreen();
  });

  it('says so when the API does not know the person yet', async () => {
    await renderSettings({
      intercept: async (request, forward) =>
        request.url.endsWith('/api/v1/me') && request.method === 'GET'
          ? Response.json(
              {
                status: 404,
                title: 'The user has not registered a profile yet.',
                code: 'user.not_registered',
              },
              { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : forward(request),
    });

    expect(await screen.findByText('Your account is not set up yet', {}, LONG)).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-display-name')).toBeNull();
  });
});

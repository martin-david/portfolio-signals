import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  AuthError,
  AuthProvider,
  createAuthController,
  type AuthController,
  type AuthStrategy,
} from '@/auth';
import { renderUi } from '@/test/renderUi';

import { SignInScreen } from './SignInScreen';

function strategyDouble(overrides: Partial<AuthStrategy> = {}): AuthStrategy {
  return {
    mode: 'dev',
    restore: jest.fn(async () => null),
    signIn: jest.fn(async () => ({ suggestedProfile: null })),
    signOut: jest.fn(async () => undefined),
    getAuthHeaders: jest.fn(async () => ({})),
    ...overrides,
  };
}

async function renderSignIn(
  overrides: Partial<AuthStrategy> = {},
  prepare?: (controller: AuthController) => Promise<void>,
) {
  const strategy = strategyDouble(overrides);
  const controller = createAuthController(strategy);
  await controller.restore();
  await prepare?.(controller);
  await renderUi(
    <AuthProvider controller={controller}>
      <SignInScreen />
    </AuthProvider>,
  );
  return { strategy, controller };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('the demo build', () => {
  it('says what the demo is, and opens it without asking for anything', async () => {
    const { strategy } = await renderSignIn({ mode: 'mock' });

    expect(screen.getByText(/fictional companies and invented figures/)).toBeOnTheScreen();
    expect(screen.queryByTestId('sign-in-dev-user')).toBeNull();
    await press('Open the demo');

    await waitFor(() => expect(strategy.signIn).toHaveBeenCalledWith(undefined));
  });
});

describe('the development build', () => {
  it('signs in as the user named in the field, which starts out as "demo"', async () => {
    const { strategy } = await renderSignIn({ mode: 'dev' });

    expect(screen.getByTestId('sign-in-dev-user')).toHaveDisplayValue('demo');
    await fireEvent.changeText(screen.getByTestId('sign-in-dev-user'), '  ada  ');
    await press('Sign in');

    await waitFor(() => expect(strategy.signIn).toHaveBeenCalledWith({ devUser: 'ada' }));
  });

  it('refuses a name the backend could not receive, and says why next to the field', async () => {
    const { strategy } = await renderSignIn({ mode: 'dev' });

    await fireEvent.changeText(screen.getByTestId('sign-in-dev-user'), 'two words');
    await press('Sign in');

    expect(
      await screen.findByText('Use 1 to 64 letters, digits, dots, dashes or underscores.'),
    ).toBeOnTheScreen();
    expect(strategy.signIn).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('sign-in-dev-user'), 'two-words');
    expect(
      screen.queryByText('Use 1 to 64 letters, digits, dots, dashes or underscores.'),
    ).toBeNull();
  });

  it('signs in from the keyboard', async () => {
    const { strategy } = await renderSignIn({ mode: 'dev' });

    await fireEvent(screen.getByTestId('sign-in-dev-user'), 'submitEditing');

    await waitFor(() => expect(strategy.signIn).toHaveBeenCalledWith({ devUser: 'demo' }));
  });
});

describe('the production build', () => {
  it('sends the person to their identity provider', async () => {
    const { strategy } = await renderSignIn({ mode: 'oidc' });

    expect(
      screen.getByText('You continue on the sign-in page of your identity provider.'),
    ).toBeOnTheScreen();
    await press('Sign in');

    await waitFor(() => expect(strategy.signIn).toHaveBeenCalledWith(undefined));
  });

  it("shows the provider's own message when the sign-in fails", async () => {
    await renderSignIn({
      mode: 'oidc',
      signIn: jest.fn().mockRejectedValue(new AuthError('The user is blocked.')),
    });

    await press('Sign in');

    expect(await screen.findByText("Couldn't sign you in")).toBeOnTheScreen();
    expect(screen.getByText('The user is blocked.')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });

  it('keeps the details of an unexpected failure to itself', async () => {
    await renderSignIn({
      mode: 'oidc',
      signIn: jest.fn().mockRejectedValue(new Error('ECONNRESET at 10.0.0.4:443')),
    });

    await press('Sign in');

    expect(await screen.findByText('Signing in did not work. Try again.')).toBeOnTheScreen();
    expect(screen.queryByText(/ECONNRESET/)).toBeNull();
  });

  it('says nothing when the person closes the provider page', async () => {
    const { controller } = await renderSignIn({ mode: 'oidc', signIn: jest.fn(async () => null) });

    await press('Sign in');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen());
    expect(screen.queryByText("Couldn't sign you in")).toBeNull();
    expect(controller.getState().status).toBe('signedOut');
  });

  it('shows progress while the provider is being reached, and only one attempt at a time', async () => {
    let finish: () => void = () => undefined;
    const { strategy } = await renderSignIn({
      mode: 'oidc',
      signIn: jest.fn(
        () =>
          new Promise<null>((resolve) => {
            finish = () => resolve(null);
          }),
      ),
    });

    await press('Sign in');
    const busy = await screen.findByRole('button', { name: 'Sign in, in progress' });
    await fireEvent.press(busy);

    expect(strategy.signIn).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });
});

describe('after a session ended', () => {
  it('says so, rather than showing a bare sign-in', async () => {
    await renderSignIn({ mode: 'oidc' }, async (controller) => {
      await controller.signIn();
      controller.expire();
    });

    expect(screen.getByText('Your session ended')).toBeOnTheScreen();
    expect(screen.getByText('Sign in again to carry on where you left off.')).toBeOnTheScreen();
  });

  it('does not say it to someone who never signed in', async () => {
    await renderSignIn({ mode: 'oidc' });

    expect(screen.queryByText('Your session ended')).toBeNull();
  });
});

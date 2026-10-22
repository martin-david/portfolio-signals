import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import type { FetchLike } from '@/api/createApiClient';
import type { AppConfig } from '@/config/env';
import { createTestApi } from '@/test/apiTestUtils';
import { renderUi } from '@/test/renderUi';

import { ProfileForm } from './ProfileForm';

const config: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'empty',
};

function withFetch(fetchImpl: FetchLike) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider
        config={config}
        auth={{ getAuthHeaders: async () => ({ 'X-Dev-User': 'tester' }) }}
        queryClient={queryClient}
        fetchImpl={fetchImpl}
      >
        {children}
      </ApiProvider>
    );
  };
}

const problem = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify({ status, ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

const submit = () => fireEvent.press(screen.getByRole('button', { name: /Continue|Save/ }));

describe('ProfileForm', () => {
  it('asks for both details before it sends anything', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>();
    const Wrapper = withFetch(fetchImpl);
    await renderUi(
      <Wrapper>
        <ProfileForm initial={{ displayName: '', email: '' }} submitLabel="Continue" />
      </Wrapper>,
    );

    await submit();

    expect(await screen.findByText('Enter the name to show for your account.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your e-mail address.')).toBeOnTheScreen();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the details without the spaces around them, and reports the saved profile', async () => {
    const { wrapper: Wrapper, backend } = createTestApi('empty');
    const onSaved = jest.fn();
    await renderUi(
      <Wrapper>
        <ProfileForm
          initial={{ displayName: '', email: '' }}
          submitLabel="Continue"
          onSaved={onSaved}
        />
      </Wrapper>,
    );

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), '  Ada Byron ');
    await fireEvent.changeText(screen.getByTestId('profile-email'), ' ada@example.test ');
    await submit();

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toMatchObject({
      displayName: 'Ada Byron',
      email: 'ada@example.test',
    });
    const me = await backend.fetch(
      new Request('https://mock.invalid/api/v1/me', { headers: { 'X-Dev-User': 'tester' } }),
    );
    expect(await me.json()).toMatchObject({ displayName: 'Ada Byron' });
  });

  it("puts the API's messages next to the fields they are about, and drops one when its field is edited", async () => {
    const Wrapper = withFetch(async () =>
      problem(400, {
        title: 'One or more validation errors occurred.',
        errors: { Email: ['This address already has an account.'] },
      }),
    );
    await renderUi(
      <Wrapper>
        <ProfileForm
          initial={{ displayName: 'Ada Byron', email: 'ada@example.test' }}
          submitLabel="Continue"
        />
      </Wrapper>,
    );

    await submit();

    expect(await screen.findByText('This address already has an account.')).toBeOnTheScreen();
    expect(screen.queryByText("Couldn't save your details")).toBeNull();

    await fireEvent.changeText(screen.getByTestId('profile-email'), 'ada@example.com');
    expect(screen.queryByText('This address already has an account.')).toBeNull();
  });

  it('reports a failure that no field explains as a problem with the whole form', async () => {
    const Wrapper = withFetch(async () => problem(500, { title: 'Internal Server Error' }));
    await renderUi(
      <Wrapper>
        <ProfileForm
          initial={{ displayName: 'Ada Byron', email: 'ada@example.test' }}
          submitLabel="Continue"
        />
      </Wrapper>,
    );

    await submit();

    expect(await screen.findByText("Couldn't save your details")).toBeOnTheScreen();
    expect(screen.getByText('The server had a problem. Try again in a moment.')).toBeOnTheScreen();
  });

  it('shows progress while saving, and does not send twice', async () => {
    let release: () => void = () => undefined;
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve(
              new Response(
                JSON.stringify({
                  displayName: 'Ada Byron',
                  email: 'ada@example.test',
                  plan: 'Free',
                  registeredAt: '2026-10-21T10:00:00Z',
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              ),
            );
        }),
    );
    const Wrapper = withFetch(fetchImpl);
    await renderUi(
      <Wrapper>
        <ProfileForm
          initial={{ displayName: 'Ada Byron', email: 'ada@example.test' }}
          submitLabel="Continue"
        />
      </Wrapper>,
    );

    await submit();
    const busy = await screen.findByRole('button', { name: 'Continue, in progress' });
    await fireEvent.press(busy);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen());
  });

  it('keeps the button off until something was changed, when it is asked to', async () => {
    const { wrapper: Wrapper } = createTestApi('happy');
    await renderUi(
      <Wrapper>
        <ProfileForm
          initial={{ displayName: 'Ada Byron', email: 'ada@example.test' }}
          submitLabel="Save"
          requireChange
        />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), 'Ada B.');

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    await fireEvent.changeText(screen.getByTestId('profile-display-name'), ' Ada Byron ');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

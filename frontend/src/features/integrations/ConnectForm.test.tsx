import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import type { FetchLike } from '@/api/createApiClient';
import type { IntegrationDto } from '@/api/schema';
import type { AppConfig } from '@/config/env';
import { createTestApi } from '@/test/apiTestUtils';
import { renderUi } from '@/test/renderUi';

import { ConnectForm } from './ConnectForm';

const config: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'happy',
};

function integration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    provider: 'Etoro',
    status: null,
    syncIntervalMinutes: 10080,
    connectedAt: null,
    lastAttemptAt: null,
    lastSuccessfulSyncAt: null,
    nextSyncDueAt: null,
    lastFailure: null,
    requiredCredentialFields: ['apiKey', 'userKey'],
    ...overrides,
  };
}

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

const field = (provider: string, name: string) =>
  screen.getByTestId(`credential-${provider}-${name}`);

describe('ConnectForm', () => {
  it('asks for the credentials the API lists, for the provider and the situation', async () => {
    const { wrapper: Wrapper } = createTestApi('happy');
    const props = { onConnected: jest.fn(), onCancel: jest.fn() };

    const view = await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} {...props} />
      </Wrapper>,
    );
    expect(screen.getByText('Connect eToro')).toBeOnTheScreen();
    expect(screen.getByLabelText('API key')).toBeOnTheScreen();
    expect(screen.getByLabelText('User key')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeOnTheScreen();
    await view.unmount();

    await renderUi(
      <Wrapper>
        <ConnectForm
          integration={integration({
            provider: 'TipRanks',
            requiredCredentialFields: ['apiKey'],
            status: 'Active',
          })}
          {...props}
        />
      </Wrapper>,
    );
    expect(screen.getByText('Replace the TipRanks credentials')).toBeOnTheScreen();
    expect(screen.queryByLabelText('User key')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save credentials' })).toBeOnTheScreen();
  });

  it('says it is a reconnection when the credentials were rejected', async () => {
    const { wrapper: Wrapper } = createTestApi('happy');
    await renderUi(
      <Wrapper>
        <ConnectForm
          integration={integration({ status: 'CredentialsRejected' })}
          onConnected={jest.fn()}
          onCancel={jest.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('Reconnect eToro')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeOnTheScreen();
  });

  it('masks the keys, lets the person look at what they typed, and offers no autofill', async () => {
    const { wrapper: Wrapper } = createTestApi('happy');
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={jest.fn()} onCancel={jest.fn()} />
      </Wrapper>,
    );

    expect(field('Etoro', 'apiKey').props.secureTextEntry).toBe(true);
    expect(field('Etoro', 'apiKey').props.autoComplete).toBe('off');
    expect(field('Etoro', 'apiKey').props.importantForAutofill).toBe('no');

    await fireEvent.press(screen.getByLabelText('Show API key'));

    expect(field('Etoro', 'apiKey').props.secureTextEntry).toBe(false);
    expect(field('Etoro', 'userKey').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Hide API key')).toBeOnTheScreen();
  });

  it('names each missing key before it sends anything', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>();
    const Wrapper = withFetch(fetchImpl);
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={jest.fn()} onCancel={jest.fn()} />
      </Wrapper>,
    );

    await fireEvent.changeText(field('Etoro', 'apiKey'), 'key-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('User key is required.')).toBeOnTheScreen();
    expect(screen.queryByText('API key is required.')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the keys once, trimmed, and forgets them when they are accepted', async () => {
    const { wrapper: Wrapper, backend } = createTestApi('empty');
    await backend.fetch(
      new Request('https://mock.invalid/api/v1/me', {
        method: 'PUT',
        headers: { 'X-Dev-User': 'tester', 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Ada', email: 'ada@example.test' }),
      }),
    );
    const onConnected = jest.fn();
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={onConnected} onCancel={jest.fn()} />
      </Wrapper>,
    );

    await fireEvent.changeText(field('Etoro', 'apiKey'), '  key-1 ');
    await fireEvent.changeText(field('Etoro', 'userKey'), 'user-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    const connected = await backend.fetch(
      new Request('https://mock.invalid/api/v1/integrations', {
        headers: { 'X-Dev-User': 'tester' },
      }),
    );
    expect(
      ((await connected.json()) as IntegrationDto[]).find((i) => i.provider === 'Etoro')?.status,
    ).toBe('Active');
    expect(field('Etoro', 'apiKey').props.value).toBe('');
    expect(field('Etoro', 'userKey').props.value).toBe('');
  });

  it("shows the API's reason next to the keys, and drops it when a key is edited", async () => {
    const Wrapper = withFetch(async () =>
      problem(400, {
        title: 'One or more validation errors occurred.',
        errors: { Credentials: ['Credentials for Etoro must include: apiKey, userKey.'] },
      }),
    );
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={jest.fn()} onCancel={jest.fn()} />
      </Wrapper>,
    );
    await fireEvent.changeText(field('Etoro', 'apiKey'), 'key-1');
    await fireEvent.changeText(field('Etoro', 'userKey'), 'user-1');

    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText("Couldn't save the credentials")).toBeOnTheScreen();
    expect(
      screen.getByText('Credentials for Etoro must include: apiKey, userKey.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(field('Etoro', 'userKey'), 'user-2');
    expect(screen.queryByText("Couldn't save the credentials")).toBeNull();
  });

  it('reports a failure of the server in plain words and keeps what was typed', async () => {
    const Wrapper = withFetch(async () => problem(500, { title: 'Internal Server Error' }));
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={jest.fn()} onCancel={jest.fn()} />
      </Wrapper>,
    );
    await fireEvent.changeText(field('Etoro', 'apiKey'), 'key-1');
    await fireEvent.changeText(field('Etoro', 'userKey'), 'user-1');

    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(
      await screen.findByText('The server had a problem. Try again in a moment.'),
    ).toBeOnTheScreen();
    expect(field('Etoro', 'apiKey').props.value).toBe('key-1');
  });

  it('can be dismissed', async () => {
    const { wrapper: Wrapper } = createTestApi('happy');
    const onCancel = jest.fn();
    await renderUi(
      <Wrapper>
        <ConnectForm integration={integration()} onConnected={jest.fn()} onCancel={onCancel} />
      </Wrapper>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

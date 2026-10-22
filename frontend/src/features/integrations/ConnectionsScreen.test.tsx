import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import type { MockScenario } from '@/config/env';
import { createMockBackend, type MockBackend } from '@/mocks/mockBackend';
import { useRefreshWhenSyncCompletes } from '@/features/sync/hooks';
import { createTestApi } from '@/test/apiTestUtils';
import { renderUi } from '@/test/renderUi';
import { ToastProvider } from '@/ui';

import { ConnectionsScreen } from './ConnectionsScreen';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

/** The app frame mounts this once; the screen relies on it to refresh what a finished sync changed. */
function SyncRefresh() {
  useRefreshWhenSyncCompletes();
  return null;
}

async function register(backend: MockBackend) {
  await backend.fetch(
    new Request('https://mock.invalid/api/v1/me', {
      method: 'PUT',
      headers: { 'X-Dev-User': 'tester', 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ada', email: 'ada@example.test' }),
    }),
  );
}

async function renderScreen(scenario: MockScenario) {
  const api = createTestApi(scenario);
  if (scenario === 'empty') {
    await register(api.backend);
  }
  const Wrapper = api.wrapper;
  await renderUi(
    <Wrapper>
      <ToastProvider>
        <SyncRefresh />
        <ConnectionsScreen />
      </ToastProvider>
    </Wrapper>,
  );
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading connections')).toBeNull();
    expect(screen.queryByLabelText('Loading sync history')).toBeNull();
    expect(screen.queryByLabelText('Loading snapshots')).toBeNull();
  });
  await screen.findByTestId('provider-card-Etoro');
  return api;
}

const card = (provider: 'Etoro' | 'TipRanks') =>
  within(screen.getByTestId(`provider-card-${provider}`));

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('with both providers connected', () => {
  it('shows each provider, how the recent syncs went and the saved snapshots', async () => {
    await renderScreen('happy');

    expect(screen.getByRole('header', { name: 'Connections' })).toBeOnTheScreen();
    expect(card('Etoro').getByText('Connected')).toBeOnTheScreen();
    expect(card('TipRanks').getByText('Connected')).toBeOnTheScreen();
    expect(card('Etoro').getByRole('button', { name: 'Sync now' })).toBeEnabled();
    expect(screen.getAllByText('eToro scheduled sync')).toHaveLength(2);
    expect(screen.getAllByText('TipRanks scheduled sync')).toHaveLength(2);
    expect(screen.getByText(/positions, the latest/)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('runs a manual sync, follows it to the end and then holds the next one back', async () => {
    await renderScreen('happy');

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Sync now' }));

    expect(await card('Etoro').findByText('Sync queued')).toBeOnTheScreen();
    expect(await screen.findByText('eToro sync queued.')).toBeOnTheScreen();
    expect(screen.getByText('eToro manual sync')).toBeOnTheScreen();
    expect(card('TipRanks').getByRole('button', { name: 'Sync now' })).toBeEnabled();

    await advance(5_000);

    await waitFor(() =>
      expect(
        card('Etoro').getByText(
          'Manual syncs are limited to one every 15 minutes. Try again in 15 minutes.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(card('Etoro').getByRole('button', { name: 'Sync now' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByText(/15 items processed in \d+ seconds?\./)).toBeOnTheScreen(),
    );
    await waitFor(() => expect(card('Etoro').getAllByText('just now').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText(/positions/).length).toBe(2));
  });

  it('lets the cooldown run out on its own', async () => {
    await renderScreen('happy');
    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Sync now' }));
    await advance(5_000);
    await waitFor(() =>
      expect(card('Etoro').getByRole('button', { name: 'Sync now' })).toBeDisabled(),
    );

    await advance(16 * 60_000);

    await waitFor(() =>
      expect(card('Etoro').getByRole('button', { name: 'Sync now' })).toBeEnabled(),
    );
  });

  it('disconnects a provider only after the person confirms', async () => {
    await renderScreen('happy');

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Disconnect eToro' }));

    expect(await screen.findByText('Disconnect eToro?')).toBeOnTheScreen();
    expect(screen.getByText(/the stored credentials are deleted/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Disconnect eToro?')).toBeNull());
    expect(card('Etoro').getByText('Connected')).toBeOnTheScreen();

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Disconnect eToro' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('eToro disconnected.')).toBeOnTheScreen();
    await waitFor(() => expect(card('Etoro').getByText('Disconnected')).toBeOnTheScreen());
    expect(card('Etoro').getByRole('button', { name: 'Connect eToro' })).toBeOnTheScreen();
    expect(card('TipRanks').getByText('Connected')).toBeOnTheScreen();
  });
});

describe('before anything is connected', () => {
  it('invites the person to connect, and says what the empty lists will hold', async () => {
    await renderScreen('empty');

    expect(card('Etoro').getByText('Not connected')).toBeOnTheScreen();
    expect(card('TipRanks').getByText('Not connected')).toBeOnTheScreen();
    expect(card('Etoro').queryByRole('button', { name: 'Sync now' })).toBeNull();
    expect(screen.getByText('No syncs yet')).toBeOnTheScreen();
    expect(screen.getByText('No snapshots yet')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('connects a provider with the keys it asks for', async () => {
    await renderScreen('empty');

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Connect eToro' }));
    await fireEvent.changeText(screen.getByTestId('credential-Etoro-apiKey'), 'demo-api-key');
    await fireEvent.changeText(screen.getByTestId('credential-Etoro-userKey'), 'demo-user-key');
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));

    expect(
      await screen.findByText('eToro connected. Use Sync now to fetch your data.'),
    ).toBeOnTheScreen();
    await waitFor(() => expect(card('Etoro').getByText('Connected')).toBeOnTheScreen());
    expect(screen.queryByTestId('credential-Etoro-apiKey')).toBeNull();
    expect(card('Etoro').getByRole('button', { name: 'Sync now' })).toBeEnabled();
    expect(card('TipRanks').getByText('Not connected')).toBeOnTheScreen();
  });

  it('can be abandoned halfway without keeping what was typed', async () => {
    await renderScreen('empty');
    await fireEvent.press(card('TipRanks').getByRole('button', { name: 'Connect TipRanks' }));
    await fireEvent.changeText(screen.getByTestId('credential-TipRanks-apiKey'), 'half-typed');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(card('TipRanks').getByRole('button', { name: 'Connect TipRanks' }));

    expect(screen.getByTestId('credential-TipRanks-apiKey').props.value).toBe('');
  });
});

describe('when something is wrong', () => {
  it('reports rate limiting by the provider, without making an alarm of it', async () => {
    await renderScreen('rate-limited');

    expect(screen.getByText('TipRanks is rate limiting requests')).toBeOnTheScreen();
    expect(screen.getByText(/the app backs off and retries on its own/)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(card('TipRanks').getByText('Connected, last sync failed')).toBeOnTheScreen();
    expect(card('TipRanks').getByText(/Rate limited, /)).toBeOnTheScreen();
  });

  it('asks to reconnect when the credentials were rejected, and takes the notice away once they are replaced', async () => {
    await renderScreen('credentials-rejected');

    expect(screen.getByText('eToro rejected your credentials')).toBeOnTheScreen();
    expect(card('Etoro').getByText('Credentials rejected', { exact: true })).toBeOnTheScreen();

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Reconnect' }));
    expect(await card('Etoro').findByText('Reconnect eToro')).toBeOnTheScreen();
    // The notice no longer offers a second way into the form that is already open.
    expect(screen.getAllByRole('button', { name: 'Reconnect' })).toHaveLength(1);

    await fireEvent.changeText(screen.getByTestId('credential-Etoro-apiKey'), 'new-api-key');
    await fireEvent.changeText(screen.getByTestId('credential-Etoro-userKey'), 'new-user-key');
    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Reconnect' }));

    await waitFor(() => expect(screen.queryByText('eToro rejected your credentials')).toBeNull());
    expect(card('Etoro').getByText('Connected')).toBeOnTheScreen();
  });

  it('shows what happens when a provider cannot be reached', async () => {
    await renderScreen('failing');

    await fireEvent.press(card('Etoro').getByRole('button', { name: 'Sync now' }));
    await advance(5_000);

    expect(await screen.findByText('eToro is unavailable')).toBeOnTheScreen();
    expect(screen.getByText(/^Provider unavailable: /)).toBeOnTheScreen();
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(card('Etoro').getByText('Connected, last sync failed')).toBeOnTheScreen(),
    );
    expect(card('TipRanks').getByText('Connected')).toBeOnTheScreen();
  });
});

describe('when the API cannot be reached', () => {
  it('says so and tries again on request', async () => {
    const backend = createMockBackend({ scenario: 'happy' });
    let down = true;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ApiProvider
          config={{
            apiMode: 'mock',
            apiBaseUrl: 'https://mock.invalid',
            authMode: 'mock',
            oidc: null,
            mockScenario: 'happy',
          }}
          auth={{ getAuthHeaders: async () => ({ 'X-Dev-User': 'tester' }) }}
          queryClient={queryClient}
          fetchImpl={async (request) =>
            request.url.endsWith('/integrations') && down
              ? Promise.reject(new TypeError('offline'))
              : backend.fetch(request)
          }
        >
          {children}
        </ApiProvider>
      );
    }
    await renderUi(
      <Wrapper>
        <ToastProvider>
          <ConnectionsScreen />
        </ToastProvider>
      </Wrapper>,
    );

    expect(await screen.findByText("Couldn't load your connections")).toBeOnTheScreen();
    expect(
      screen.getByText("Can't reach the server. Check your connection and try again."),
    ).toBeOnTheScreen();

    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByTestId('provider-card-Etoro')).toBeOnTheScreen());
  });
});

import { fireEvent, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import type { IntegrationDto, SyncRunDto } from '@/api/schema';
import { createTestApi } from '@/test/apiTestUtils';
import { renderUi } from '@/test/renderUi';

import { ProviderCard, type ProviderCardProps } from './ProviderCard';

const NOW = new Date('2026-10-21T12:00:00Z');

function integration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    provider: 'Etoro',
    status: 'Active',
    syncIntervalMinutes: 10080,
    connectedAt: '2026-09-21T12:00:00Z',
    lastAttemptAt: '2026-10-21T08:00:00Z',
    lastSuccessfulSyncAt: '2026-10-21T08:00:00Z',
    nextSyncDueAt: '2026-10-28T08:00:00Z',
    lastFailure: null,
    requiredCredentialFields: ['apiKey', 'userKey'],
    ...overrides,
  };
}

function run(overrides: Partial<SyncRunDto> = {}): SyncRunDto {
  return {
    id: 'run-1',
    provider: 'Etoro',
    trigger: 'Manual',
    status: 'Queued',
    requestedAt: '2026-10-21T11:59:00Z',
    startedAt: null,
    completedAt: null,
    itemsProcessed: 0,
    failure: null,
    skipReason: null,
    ...overrides,
  };
}

async function renderCard(overrides: Partial<ProviderCardProps> = {}) {
  const { wrapper: Wrapper } = createTestApi('happy');
  const props: ProviderCardProps = {
    integration: integration(),
    runs: [],
    allowsManualSync: true,
    now: NOW,
    syncing: false,
    syncError: null,
    formOpen: false,
    onSync: jest.fn(),
    onOpenForm: jest.fn(),
    onCloseForm: jest.fn(),
    onConnected: jest.fn(),
    onDisconnect: jest.fn(),
    ...overrides,
  };
  await renderUi(
    <Wrapper>
      <ProviderCard {...props} />
    </Wrapper>,
  );
  return props;
}

describe('a connected provider', () => {
  it('says where it stands, when it last worked and when it works next', async () => {
    await renderCard();

    expect(screen.getByRole('header', { name: 'eToro' })).toBeOnTheScreen();
    expect(screen.getByText('Connected')).toBeOnTheScreen();
    expect(
      screen.getByText('Your holdings, what you paid for them and your cash.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Connected since')).toBeOnTheScreen();
    expect(screen.getByText('21 Sep 2026')).toBeOnTheScreen();
    expect(screen.getByText('Last attempt')).toBeOnTheScreen();
    expect(screen.getAllByText('4 hours ago')).toHaveLength(2);
    expect(screen.getAllByText('21 Oct 2026, 08:00 UTC')).toHaveLength(2);
    expect(screen.getByText('Next scheduled sync')).toBeOnTheScreen();
    expect(screen.getByText('in 7 days')).toBeOnTheScreen();
    expect(screen.getByText('weekly')).toBeOnTheScreen();
  });

  it('offers to sync, replace the credentials and disconnect', async () => {
    const props = await renderCard();

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Replace credentials' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect eToro' }));

    expect(props.onSync).toHaveBeenCalledTimes(1);
    expect(props.onOpenForm).toHaveBeenCalledTimes(1);
    expect(props.onDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Connect eToro' })).toBeNull();
  });

  it('shows a request for a sync as busy', async () => {
    await renderCard({ syncing: true });

    expect(screen.getByRole('button', { name: 'Sync now, in progress' })).toBeOnTheScreen();
  });

  it('shows a run that is queued, then one that is running, in place of the button', async () => {
    await renderCard({ runs: [run({ status: 'Queued' })] });

    expect(screen.getByText('Sync queued')).toBeOnTheScreen();
    expect(screen.getByText('This page updates when the sync finishes.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });

  it('shows a running scheduled sync too', async () => {
    await renderCard({ runs: [run({ status: 'Running', trigger: 'Scheduled' })] });

    expect(screen.getByText('Syncing now')).toBeOnTheScreen();
  });

  it('keeps the button off while a manual sync is too soon, and says how long to wait', async () => {
    await renderCard({ integration: integration({ lastAttemptAt: '2026-10-21T11:56:00Z' }) });

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(
      screen.getByText(
        'Manual syncs are limited to one every 15 minutes. Try again in 11 minutes.',
      ),
    ).toBeOnTheScreen();
  });

  it('has no manual sync on a plan that syncs on a schedule only', async () => {
    await renderCard({ allowsManualSync: false });

    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
    expect(
      screen.getByText('Your plan syncs weekly. Manual syncs are not part of it.'),
    ).toBeOnTheScreen();
  });

  it('reports the last failure with its reason', async () => {
    await renderCard({
      integration: integration({
        lastFailure: {
          kind: 'Unavailable',
          message: 'eToro answered HTTP 503.',
          at: '2026-10-21T11:30:00Z',
        },
      }),
    });

    expect(screen.getByText('Connected, last sync failed')).toBeOnTheScreen();
    expect(screen.getByText('Provider unavailable, 30 minutes ago')).toBeOnTheScreen();
    expect(screen.getByText('eToro answered HTTP 503.')).toBeOnTheScreen();
  });

  it('explains why a sync could not be started, as a warning when it is only too soon', async () => {
    await renderCard({
      syncError: new ApiError({
        kind: 'problem',
        status: 429,
        title: 'Etoro was synchronized recently. Try again in about 9 minute(s).',
        code: 'sync.cooldown',
      }),
    });

    expect(screen.getByText("Couldn't start the eToro sync")).toBeOnTheScreen();
    expect(
      screen.getByText('Etoro was synchronized recently. Try again in about 9 minute(s).'),
    ).toBeOnTheScreen();
  });
});

describe('a provider that is not connected', () => {
  const idle = {
    status: null,
    connectedAt: null,
    lastAttemptAt: null,
    nextSyncDueAt: null,
  } as const;

  it('invites the person to connect it, and shows nothing it has not got', async () => {
    const props = await renderCard({ integration: integration({ provider: 'TipRanks', ...idle }) });

    expect(screen.getByText('Not connected')).toBeOnTheScreen();
    expect(screen.queryByText('Last attempt')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect TipRanks' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Connect TipRanks' }));

    expect(props.onOpenForm).toHaveBeenCalledTimes(1);
  });

  it('treats a disconnected provider the same way', async () => {
    await renderCard({ integration: integration({ ...idle, status: 'Disconnected' }) });

    expect(screen.getByText('Disconnected')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connect eToro' })).toBeOnTheScreen();
  });
});

describe('a provider whose credentials were rejected', () => {
  it('asks to reconnect, and still lets the person disconnect', async () => {
    const props = await renderCard({
      integration: integration({
        status: 'CredentialsRejected',
        lastFailure: {
          kind: 'Unauthorized',
          message: 'eToro rejected the stored credentials.',
          at: NOW.toISOString(),
        },
      }),
    });

    expect(screen.getByText('Credentials rejected', { exact: true })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
    expect(screen.queryByText('Next scheduled sync')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Reconnect' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect eToro' }));

    expect(props.onOpenForm).toHaveBeenCalledTimes(1);
    expect(props.onDisconnect).toHaveBeenCalledTimes(1);
  });
});

describe('the connect form inside the card', () => {
  it('replaces the actions while it is open', async () => {
    await renderCard({
      formOpen: true,
      integration: integration({ status: null, connectedAt: null }),
    });

    expect(screen.getByText('Connect eToro', { exact: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('API key')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disconnect eToro' })).toBeNull();
  });
});

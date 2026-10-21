import type { IntegrationDto } from '@/api/schema';
import { loadDemo } from '@/test/demo';

import { connectionState, freshnessNotices, providerLabel } from './freshness';

const NOW = new Date('2026-10-21T12:00:00Z');

function integration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    provider: 'Etoro',
    status: 'Active',
    syncIntervalMinutes: 10080,
    connectedAt: '2026-09-21T12:00:00Z',
    lastAttemptAt: '2026-10-21T10:00:00Z',
    lastSuccessfulSyncAt: '2026-10-21T10:00:00Z',
    nextSyncDueAt: '2026-10-28T10:00:00Z',
    lastFailure: null,
    requiredCredentialFields: ['apiKey', 'userKey'],
    ...overrides,
  };
}

describe('freshnessNotices', () => {
  it('has nothing to say about healthy, on-time connections', () => {
    expect(freshnessNotices([integration(), integration({ provider: 'TipRanks' })], NOW)).toEqual(
      [],
    );
  });

  it('reports rate limiting with when the next attempt happens and how old the data is', async () => {
    const { integrations } = await loadDemo('rate-limited');
    const clock = new Date();

    const notices = freshnessNotices(integrations, clock);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      provider: 'TipRanks',
      kind: 'failure',
      tone: 'warning',
      title: 'TipRanks is rate limiting requests',
    });
    expect(notices[0].body).toContain('The next attempt is in ');
    expect(notices[0].body).toContain('You are seeing data from 3 days ago.');
  });

  it('asks to reconnect when credentials were rejected', async () => {
    const { integrations } = await loadDemo('credentials-rejected');

    const [notice] = freshnessNotices(integrations, new Date());

    expect(notice).toMatchObject({
      provider: 'Etoro',
      kind: 'credentials-rejected',
      tone: 'danger',
      title: 'eToro rejected your credentials',
      action: 'reconnect',
    });
    expect(notice.body).toContain('Syncing is paused until you reconnect.');
  });

  it('reports an unavailable provider', () => {
    const [notice] = freshnessNotices(
      [
        integration({
          lastFailure: { kind: 'Unavailable', message: 'HTTP 503', at: '2026-10-21T11:30:00Z' },
          nextSyncDueAt: '2026-10-21T12:35:00Z',
        }),
      ],
      NOW,
    );

    expect(notice.title).toBe('eToro is unavailable');
    expect(notice.body).toBe(
      'The attempt 30 minutes ago did not get through. The next attempt is in 35 minutes. You are seeing data from 2 hours ago.',
    );
  });

  it('reports unreadable and unknown failures', () => {
    const titleFor = (kind: 'InvalidResponse' | 'Unknown') =>
      freshnessNotices(
        [
          integration({
            provider: 'TipRanks',
            lastFailure: { kind, message: 'Boom', at: '2026-10-21T11:00:00Z' },
          }),
        ],
        NOW,
      )[0].title;

    expect(titleFor('InvalidResponse')).toBe('TipRanks returned data the app could not read');
    expect(titleFor('Unknown')).toBe('The last TipRanks sync failed');
  });

  it('says when no sync has ever succeeded', () => {
    const [notice] = freshnessNotices(
      [
        integration({
          lastSuccessfulSyncAt: null,
          lastFailure: { kind: 'RateLimited', message: 'x', at: '2026-10-21T11:00:00Z' },
          nextSyncDueAt: null,
        }),
      ],
      NOW,
    );

    expect(notice.body).toContain('No sync has succeeded yet.');
    expect(notice.body).not.toContain('The next attempt');
  });

  it('reports a sync that is later than planned, but not one that is merely queued', () => {
    const late = integration({ nextSyncDueAt: '2026-10-21T10:00:00Z' });
    const queued = integration({ nextSyncDueAt: '2026-10-21T11:45:00Z' });

    expect(freshnessNotices([late], NOW)[0]).toMatchObject({
      kind: 'overdue',
      tone: 'info',
      title: 'The eToro sync is later than planned',
    });
    expect(freshnessNotices([queued], NOW)).toEqual([]);
  });

  it('offers to connect providers that are not connected, unless asked not to', () => {
    const none = [
      integration({ status: null }),
      integration({ provider: 'TipRanks', status: 'Disconnected' }),
    ];

    const notices = freshnessNotices(none, NOW);

    expect(notices.map((n) => [n.provider, n.kind, n.action])).toEqual([
      ['Etoro', 'not-connected', 'connect'],
      ['TipRanks', 'not-connected', 'connect'],
    ]);
    expect(notices[0].body).toBe('Connect eToro to bring in your portfolio.');
    expect(notices[1].body).toBe('Connect TipRanks to see analyst signals for your holdings.');
    expect(freshnessNotices(none, NOW, { includeNotConnected: false })).toEqual([]);
  });

  it('puts the most urgent notices first', () => {
    const notices = freshnessNotices(
      [
        integration({ nextSyncDueAt: '2026-10-21T08:00:00Z' }),
        integration({ provider: 'TipRanks', status: 'CredentialsRejected' }),
        integration({ provider: 'TipRanks', status: null }),
      ],
      NOW,
    );

    expect(notices.map((n) => n.tone)).toEqual(['danger', 'info', 'info']);
  });
});

describe('connectionState and providerLabel', () => {
  it('names each state in words', () => {
    expect(connectionState({ status: 'Active', lastFailure: null })).toEqual({
      label: 'Connected',
      tone: 'positive',
    });
    expect(
      connectionState({
        status: 'Active',
        lastFailure: { kind: 'Unavailable', message: '', at: '2026-10-21T00:00:00Z' },
      }),
    ).toEqual({ label: 'Connected, last sync failed', tone: 'warning' });
    expect(connectionState({ status: 'CredentialsRejected', lastFailure: null })).toEqual({
      label: 'Credentials rejected',
      tone: 'danger',
    });
    expect(connectionState({ status: 'Disconnected', lastFailure: null })).toEqual({
      label: 'Disconnected',
      tone: 'neutral',
    });
    expect(connectionState({ status: null, lastFailure: null })).toEqual({
      label: 'Not connected',
      tone: 'neutral',
    });
  });

  it('spells the providers as their owners do', () => {
    expect(providerLabel('Etoro')).toBe('eToro');
    expect(providerLabel('TipRanks')).toBe('TipRanks');
  });
});

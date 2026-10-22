import type { IntegrationDto, SyncRunDto } from '@/api/schema';

import { describeRun, failureKindLabel, runDuration, runStatusTone, syncControl } from './history';

const NOW = new Date('2026-10-21T12:00:00Z');

function run(overrides: Partial<SyncRunDto> = {}): SyncRunDto {
  return {
    id: 'run-1',
    provider: 'Etoro',
    trigger: 'Manual',
    status: 'Succeeded',
    requestedAt: '2026-10-21T10:00:00Z',
    startedAt: '2026-10-21T10:00:02Z',
    completedAt: '2026-10-21T10:00:14Z',
    itemsProcessed: 15,
    failure: null,
    skipReason: null,
    ...overrides,
  };
}

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

describe('runDuration', () => {
  it('reads seconds and minutes in words', () => {
    expect(
      runDuration({ startedAt: '2026-10-21T10:00:00Z', completedAt: '2026-10-21T10:00:01Z' }),
    ).toBe('1 second');
    expect(
      runDuration({ startedAt: '2026-10-21T10:00:00Z', completedAt: '2026-10-21T10:00:12Z' }),
    ).toBe('12 seconds');
    expect(
      runDuration({ startedAt: '2026-10-21T10:00:00Z', completedAt: '2026-10-21T10:01:00Z' }),
    ).toBe('1 minute');
    expect(
      runDuration({ startedAt: '2026-10-21T10:00:00Z', completedAt: '2026-10-21T10:02:05Z' }),
    ).toBe('2 minutes 5 seconds');
  });

  it('has none until the run started and finished, or when the clocks disagree', () => {
    expect(runDuration({ startedAt: null, completedAt: null })).toBeNull();
    expect(runDuration({ startedAt: '2026-10-21T10:00:00Z', completedAt: null })).toBeNull();
    expect(
      runDuration({ startedAt: '2026-10-21T10:00:10Z', completedAt: '2026-10-21T10:00:00Z' }),
    ).toBeNull();
  });
});

describe('runStatusTone', () => {
  it('colours only the outcome: a rejected credential is the one failure that needs the person', () => {
    expect(runStatusTone(run())).toBe('positive');
    expect(runStatusTone(run({ status: 'Queued' }))).toBe('neutral');
    expect(runStatusTone(run({ status: 'Skipped' }))).toBe('neutral');
    expect(
      runStatusTone(
        run({
          status: 'Failed',
          failure: { kind: 'RateLimited', message: 'x', at: NOW.toISOString() },
        }),
      ),
    ).toBe('warning');
    expect(
      runStatusTone(
        run({
          status: 'Failed',
          failure: { kind: 'Unauthorized', message: 'x', at: NOW.toISOString() },
        }),
      ),
    ).toBe('danger');
  });
});

describe('describeRun', () => {
  it('describes a successful manual run with what it did and how long it took', () => {
    expect(describeRun(run(), NOW)).toEqual({
      title: 'eToro manual sync',
      statusLabel: 'Succeeded',
      tone: 'positive',
      when: '2 hours ago',
      whenExact: '21 Oct 2026, 10:00 UTC',
      detail: '15 items processed in 12 seconds.',
    });
  });

  it('describes a scheduled run, and the singular', () => {
    const described = describeRun(
      run({ trigger: 'Scheduled', provider: 'TipRanks', itemsProcessed: 1, completedAt: null }),
      NOW,
    );
    expect(described.title).toBe('TipRanks scheduled sync');
    expect(described.detail).toBe('1 item processed.');
  });

  it('says why a run did not complete', () => {
    expect(describeRun(run({ status: 'Queued' }), NOW).detail).toBe('Waiting for its turn.');
    expect(describeRun(run({ status: 'Running' }), NOW).detail).toBe('In progress.');
    expect(
      describeRun(
        run({ status: 'Skipped', skipReason: 'No portfolio has been synchronized yet.' }),
        NOW,
      ).detail,
    ).toBe('No portfolio has been synchronized yet.');
    expect(describeRun(run({ status: 'Skipped' }), NOW).detail).toBe('Nothing to do.');
    expect(
      describeRun(
        run({
          status: 'Failed',
          failure: {
            kind: 'RateLimited',
            message: 'TipRanks rate limit reached (HTTP 429).',
            at: NOW.toISOString(),
          },
        }),
        NOW,
      ).detail,
    ).toBe('Rate limited: TipRanks rate limit reached (HTTP 429).');
    expect(describeRun(run({ status: 'Failed' }), NOW).detail).toBe('The sync did not finish.');
  });

  it('has a plain label for every kind of failure', () => {
    expect(Object.keys(failureKindLabel).sort()).toEqual([
      'InvalidResponse',
      'RateLimited',
      'Unauthorized',
      'Unavailable',
      'Unknown',
    ]);
  });
});

describe('syncControl', () => {
  const base = {
    integration: integration(),
    runs: [] as SyncRunDto[],
    allowsManualSync: true,
    now: NOW,
  };

  it('offers nothing for a provider that is not connected or whose credentials were rejected', () => {
    for (const status of [null, 'Disconnected', 'CredentialsRejected'] as const) {
      expect(syncControl({ ...base, integration: integration({ status }) })).toEqual({
        kind: 'unavailable',
      });
    }
  });

  it('shows a run that is queued or running, whoever started it', () => {
    expect(
      syncControl({ ...base, runs: [run({ status: 'Running', trigger: 'Scheduled' })] }),
    ).toEqual({
      kind: 'running',
      status: 'Running',
    });
    expect(
      syncControl({ ...base, runs: [run({ status: 'Queued' })], allowsManualSync: false }),
    ).toEqual({
      kind: 'running',
      status: 'Queued',
    });
  });

  it('ignores the other provider’s runs', () => {
    expect(
      syncControl({
        ...base,
        runs: [run({ provider: 'TipRanks', status: 'Running' })],
        integration: integration({ lastAttemptAt: null }),
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('says when the plan syncs on a schedule only', () => {
    expect(syncControl({ ...base, allowsManualSync: false })).toEqual({
      kind: 'scheduled-only',
      interval: 'weekly',
    });
  });

  it('counts down the manual sync cooldown from the last attempt', () => {
    expect(
      syncControl({ ...base, integration: integration({ lastAttemptAt: '2026-10-21T11:56:00Z' }) }),
    ).toEqual({
      kind: 'cooldown',
      minutes: 11,
    });
  });

  it('is ready once the cooldown has passed', () => {
    expect(syncControl(base)).toEqual({ kind: 'ready' });
  });
});

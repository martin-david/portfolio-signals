import type { IntegrationProvider, SyncRunDto } from '@/api/schema';

import {
  MANUAL_SYNC_COOLDOWN_MINUTES,
  hasActiveRuns,
  isActiveRun,
  manualSyncCooldownMinutes,
  mergeRuns,
  runsThatFinished,
} from './runs';

function run(overrides: Partial<SyncRunDto> & { id: string }): SyncRunDto {
  return {
    provider: 'Etoro' as IntegrationProvider,
    trigger: 'Manual',
    status: 'Succeeded',
    requestedAt: '2026-10-20T10:00:00Z',
    startedAt: null,
    completedAt: null,
    itemsProcessed: 0,
    failure: null,
    skipReason: null,
    ...overrides,
  };
}

describe('sync runs', () => {
  it('knows which runs are still in flight', () => {
    expect(isActiveRun(run({ id: 'a', status: 'Queued' }))).toBe(true);
    expect(isActiveRun(run({ id: 'a', status: 'Running' }))).toBe(true);
    for (const status of ['Succeeded', 'Failed', 'Skipped'] as const) {
      expect(isActiveRun(run({ id: 'a', status }))).toBe(false);
    }
    expect(hasActiveRuns(undefined)).toBe(false);
    expect(hasActiveRuns([run({ id: 'a' }), run({ id: 'b', status: 'Running' })])).toBe(true);
  });

  it('merges new runs in front of the history without duplicates, newest first', () => {
    const old = run({ id: 'old', requestedAt: '2026-10-19T10:00:00Z' });
    const queued = run({ id: 'new', status: 'Queued', requestedAt: '2026-10-21T10:00:00Z' });
    const finished = run({ id: 'new', status: 'Succeeded', requestedAt: '2026-10-21T10:00:00Z' });

    const first = mergeRuns([queued], [old]);
    expect(first.map((r) => r.id)).toEqual(['new', 'old']);

    const second = mergeRuns([finished], first);
    expect(second).toHaveLength(2);
    expect(second[0].status).toBe('Succeeded');
    expect(mergeRuns([queued], undefined)).toEqual([queued]);
  });

  it('reports the runs that stopped being active', () => {
    const before = new Set(['a', 'b']);
    const runs = [run({ id: 'a', status: 'Running' }), run({ id: 'b', status: 'Succeeded' })];
    expect(runsThatFinished(before, runs)).toEqual(['b']);
    expect(runsThatFinished(new Set(), runs)).toEqual([]);
    expect(runsThatFinished(new Set(['gone']), runs)).toEqual(['gone']);
  });
});

describe('manualSyncCooldownMinutes', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it('is zero when nothing is known', () => {
    expect(manualSyncCooldownMinutes('Etoro', undefined, undefined, now)).toBe(0);
    expect(manualSyncCooldownMinutes('Etoro', [], { lastAttemptAt: null }, now)).toBe(0);
  });

  it('counts down from the most recent attempt for that provider', () => {
    const runs = [
      run({ id: 'a', provider: 'Etoro', requestedAt: '2026-10-21T11:50:00Z' }),
      run({ id: 'b', provider: 'TipRanks', requestedAt: '2026-10-21T11:59:00Z' }),
    ];
    expect(manualSyncCooldownMinutes('Etoro', runs, undefined, now)).toBe(5);
    expect(manualSyncCooldownMinutes('TipRanks', runs, undefined, now)).toBe(14);
  });

  it('prefers the time a run actually started and the integration last attempt', () => {
    const runs = [
      run({
        id: 'a',
        requestedAt: '2026-10-21T11:00:00Z',
        startedAt: '2026-10-21T11:55:00Z',
      }),
    ];
    expect(manualSyncCooldownMinutes('Etoro', runs, undefined, now)).toBe(10);
    expect(
      manualSyncCooldownMinutes('Etoro', runs, { lastAttemptAt: '2026-10-21T11:58:00Z' }, now),
    ).toBe(13);
  });

  it('is zero once the cooldown has passed', () => {
    const runs = [run({ id: 'a', requestedAt: '2026-10-21T11:45:00Z' })];
    expect(MANUAL_SYNC_COOLDOWN_MINUTES).toBe(15);
    expect(manualSyncCooldownMinutes('Etoro', runs, undefined, now)).toBe(0);
  });
});

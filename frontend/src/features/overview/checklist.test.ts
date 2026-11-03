import type { IntegrationDto, SyncRunDto } from '@/api/schema';

import { buildChecklist } from './checklist';

function integration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    provider: 'Etoro',
    status: null,
    syncIntervalMinutes: 10_080,
    connectedAt: null,
    lastAttemptAt: null,
    lastSuccessfulSyncAt: null,
    nextSyncDueAt: null,
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
    status: 'Running',
    requestedAt: '2026-10-21T10:00:00Z',
    startedAt: '2026-10-21T10:00:02Z',
    completedAt: null,
    itemsProcessed: 0,
    failure: null,
    skipReason: null,
    ...overrides,
  };
}

const bothActive = [
  integration({ status: 'Active' }),
  integration({ provider: 'TipRanks', status: 'Active' }),
];

const states = (steps: ReturnType<typeof buildChecklist>) =>
  Object.fromEntries(steps.map((step) => [step.key, step.state]));

describe('buildChecklist', () => {
  it('starts with nothing connected: both connections to make and a sync that has to wait', () => {
    const steps = buildChecklist([integration(), integration({ provider: 'TipRanks' })], [], true);

    expect(states(steps)).toEqual({ etoro: 'todo', tipranks: 'todo', sync: 'waiting' });
    expect(steps.map((step) => step.action)).toEqual([
      { label: 'Connect eToro', to: 'connections' },
      { label: 'Connect TipRanks', to: 'connections' },
      undefined,
    ]);
    expect(steps[2].detail).toBe('Available once eToro is connected.');
  });

  it('says what each provider is for, and what is lost without TipRanks', () => {
    const [etoro, tipranks] = buildChecklist([integration(), integration()], [], true);

    expect(etoro.detail).toContain('holdings and balances');
    expect(tipranks.detail).toContain('every holding reads No data');
  });

  it('marks what is connected as done and offers to start the first sync, with the plan schedule', () => {
    const steps = buildChecklist(bothActive, [], true);

    expect(states(steps)).toEqual({ etoro: 'done', tipranks: 'done', sync: 'todo' });
    expect(steps[0].title).toBe('eToro is connected');
    expect(steps[2].action).toEqual({ label: 'Sync now', to: 'sync' });
    expect(steps[2].detail).toContain('which syncs weekly');
  });

  it('does not offer a manual sync when the plan has none, and says when the first one runs', () => {
    const [, , sync] = buildChecklist(
      [
        integration({ status: 'Active', syncIntervalMinutes: 1_440 }),
        integration({ provider: 'TipRanks', status: 'Active' }),
      ],
      [],
      false,
    );

    expect(sync.title).toBe('Wait for the first sync');
    expect(sync.action).toBeUndefined();
    expect(sync.detail).toBe(
      'Your plan syncs daily and does not include manual syncs, so the first one runs on that schedule.',
    );
  });

  it.each(['Queued', 'Running'] as const)('follows an eToro sync that is %s', (status) => {
    const [, , sync] = buildChecklist(bothActive, [run({ status })], true);

    expect(sync.state).toBe('working');
    expect(sync.title).toBe('The first sync is running');
    expect(sync.action).toBeUndefined();
  });

  it('is not held up by a TipRanks sync, or by runs that are over', () => {
    const steps = buildChecklist(
      bothActive,
      [
        run({ id: 'a', provider: 'TipRanks', status: 'Running' }),
        run({ id: 'b', status: 'Failed' }),
        run({ id: 'c', status: 'Succeeded' }),
      ],
      true,
    );

    expect(steps[2].state).toBe('todo');
  });

  it('asks to reconnect when credentials were rejected, and keeps the sync waiting', () => {
    const steps = buildChecklist(
      [integration({ status: 'CredentialsRejected' }), integration({ provider: 'TipRanks' })],
      [],
      true,
    );

    expect(states(steps)).toEqual({ etoro: 'attention', tipranks: 'todo', sync: 'waiting' });
    expect(steps[0].title).toBe('Reconnect eToro');
    expect(steps[0].action).toEqual({ label: 'Reconnect', to: 'connections' });
  });

  it('treats a disconnected provider like one that was never connected', () => {
    const steps = buildChecklist(
      [integration({ status: 'Disconnected' }), integration({ provider: 'TipRanks' })],
      [],
      true,
    );

    expect(steps[0].state).toBe('todo');
    expect(steps[0].title).toBe('Connect eToro');
  });

  it('copes with a provider the API did not list', () => {
    const steps = buildChecklist([], undefined, true);

    expect(states(steps)).toEqual({ etoro: 'todo', tipranks: 'todo', sync: 'waiting' });
  });
});

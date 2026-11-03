import { createApiClient } from '@/api/createApiClient';
import { ApiError } from '@/api/errors';
import { unwrap, unwrapEmpty } from '@/api/request';
import type { AppConfig, MockScenario } from '@/config/env';

import { createMockBackend } from './mockBackend';

const config: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'happy',
};

const NOW = new Date('2026-10-21T12:00:00Z');

function setup(scenario: MockScenario, withAuth = true) {
  const backend = createMockBackend({ scenario, now: () => new Date(Date.now()) });
  const client = createApiClient({
    config,
    fetchImpl: backend.fetch,
    getAuthHeaders: async (): Promise<Record<string, string>> =>
      withAuth ? { 'X-Dev-User': 'tester' } : {},
  });
  return { backend, client };
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('authentication', () => {
  it('rejects a request that carries no credentials', async () => {
    const { client } = setup('happy', false);

    expect((await failure(unwrap(client.GET('/api/v1/me')))).status).toBe(401);
  });
});

describe('the empty scenario: a new user', () => {
  it('registers a profile, validating it like the backend does', async () => {
    const { client } = setup('empty');

    const missing = await failure(unwrap(client.GET('/api/v1/me')));
    expect(missing).toMatchObject({ status: 404, code: 'user.not_registered' });

    const invalid = await failure(
      unwrap(client.PUT('/api/v1/me', { body: { displayName: ' ', email: 'nope' } })),
    );
    expect(invalid.status).toBe(400);
    expect(invalid.fieldErrors).toEqual({
      email: ["'Email' is not a valid email address."],
      displayName: ["'Display Name' must not be empty."],
    });

    const created = await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );
    expect(created).toMatchObject({
      displayName: 'Ada',
      email: 'ada@example.com',
      plan: 'Free',
      allowsManualSync: true,
    });
    expect(created.etoroSyncIntervalMinutes).toBe(10080);

    expect((await unwrap(client.GET('/api/v1/me'))).displayName).toBe('Ada');
  });

  it('falls back to the signed-in user when the profile fields are empty, as the backend does with token claims', async () => {
    const { client } = setup('empty');

    const created = await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: null, email: null } }),
    );

    expect(created).toMatchObject({ displayName: 'tester', email: 'tester@example.test' });
  });

  it('needs a profile before anything else', async () => {
    const { client } = setup('empty');

    expect((await failure(unwrap(client.GET('/api/v1/integrations')))).code).toBe(
      'user.not_registered',
    );
    expect(
      (await failure(unwrap(client.POST('/api/v1/sync', { body: { provider: null } })))).code,
    ).toBe('user.not_registered');
  });

  it('connects and disconnects providers without ever echoing credentials', async () => {
    const { client } = setup('empty');
    await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );

    const before = await unwrap(client.GET('/api/v1/integrations'));
    expect(before.map((i) => [i.provider, i.status, i.requiredCredentialFields])).toEqual([
      ['Etoro', null, ['apiKey', 'userKey']],
      ['TipRanks', null, ['apiKey']],
    ]);

    const incomplete = await failure(
      unwrap(
        client.PUT('/api/v1/integrations/{provider}', {
          params: { path: { provider: 'Etoro' } },
          body: { credentials: { apiKey: 'only-one' } },
        }),
      ),
    );
    expect(incomplete.fieldErrors.credentials).toEqual([
      'Credentials for Etoro must include: apiKey, userKey.',
    ]);

    const connected = await unwrap(
      client.PUT('/api/v1/integrations/{provider}', {
        params: { path: { provider: 'Etoro' } },
        body: { credentials: { apiKey: 'SECRET-APP-KEY', userKey: 'SECRET-USER-KEY' } },
      }),
    );
    expect(connected.status).toBe('Active');
    expect(JSON.stringify(connected)).not.toContain('SECRET');
    expect(JSON.stringify(await unwrap(client.GET('/api/v1/integrations')))).not.toContain(
      'SECRET',
    );

    await unwrapEmpty(
      client.DELETE('/api/v1/integrations/{provider}', { params: { path: { provider: 'Etoro' } } }),
    );
    const again = await failure(
      unwrapEmpty(
        client.DELETE('/api/v1/integrations/{provider}', {
          params: { path: { provider: 'Etoro' } },
        }),
      ),
    );
    expect(again).toMatchObject({ status: 404, code: 'integration.not_connected' });
  });

  it('has nothing to show or sync before a provider is connected', async () => {
    const { client } = setup('empty');
    await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );

    expect((await failure(unwrap(client.GET('/api/v1/portfolio')))).code).toBe(
      'portfolio.not_synced',
    );
    expect((await failure(unwrap(client.GET('/api/v1/portfolio/analysis')))).code).toBe(
      'portfolio.not_synced',
    );
    expect(
      (
        await failure(
          unwrap(
            client.GET('/api/v1/portfolio/holdings/{symbol}', {
              params: { path: { symbol: 'NWND' } },
            }),
          ),
        )
      ).code,
    ).toBe('portfolio.not_synced');
    expect(
      (await failure(unwrap(client.POST('/api/v1/sync', { body: { provider: null } })))).code,
    ).toBe('sync.no_active_connection');
    expect(await unwrap(client.GET('/api/v1/portfolio/snapshots'))).toEqual([]);
  });

  it('runs a first sync from connecting to a scored portfolio, eToro first and TipRanks after it', async () => {
    const { client, backend } = setup('empty');
    await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );
    for (const [provider, credentials] of [
      ['Etoro', { apiKey: 'a', userKey: 'b' }],
      ['TipRanks', { apiKey: 'c' }],
    ] as const) {
      await unwrap(
        client.PUT('/api/v1/integrations/{provider}', {
          params: { path: { provider } },
          body: { credentials },
        }),
      );
    }

    const queued = await unwrap(client.POST('/api/v1/sync', { body: { provider: null } }));
    expect(queued.map((r) => [r.provider, r.status, r.trigger])).toEqual([
      ['Etoro', 'Queued', 'Manual'],
      ['TipRanks', 'Queued', 'Manual'],
    ]);

    const tooSoon = await failure(
      unwrap(client.POST('/api/v1/sync', { body: { provider: null } })),
    );
    expect(tooSoon).toMatchObject({ status: 429, code: 'sync.cooldown' });
    expect(tooSoon.message).toMatch(
      /^Etoro was synchronized recently\. Try again in about 15 minute\(s\)\.$/,
    );

    await jest.advanceTimersByTimeAsync(1_300);
    expect((await unwrap(client.GET('/api/v1/sync/runs'))).map((r) => r.status)).toEqual([
      'Running',
      'Queued',
    ]);

    await jest.advanceTimersByTimeAsync(2_600);
    const afterEtoro = await unwrap(client.GET('/api/v1/sync/runs'));
    expect(afterEtoro.find((r) => r.provider === 'Etoro')).toMatchObject({
      status: 'Succeeded',
      itemsProcessed: 15,
    });
    expect((await unwrap(client.GET('/api/v1/portfolio'))).holdings).toHaveLength(15);

    await jest.advanceTimersByTimeAsync(10_000);
    const finished = await unwrap(client.GET('/api/v1/sync/runs'));
    expect(finished.map((r) => r.status)).toEqual(['Succeeded', 'Succeeded']);

    const analysis = await unwrap(client.GET('/api/v1/portfolio/analysis'));
    expect(analysis.signalsFetchedAt).not.toBeNull();
    expect(analysis.holdings[0].assessment.verdict).toBe('HoldReviewSize');

    const integrations = await unwrap(client.GET('/api/v1/integrations'));
    expect(
      integrations.every((i) => i.lastSuccessfulSyncAt !== null && i.lastFailure === null),
    ).toBe(true);
    expect(backend.state().snapshots).toHaveLength(1);
  });

  it('skips a TipRanks sync that has no portfolio to look up yet', async () => {
    const { client } = setup('empty');
    await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );
    await unwrap(
      client.PUT('/api/v1/integrations/{provider}', {
        params: { path: { provider: 'TipRanks' } },
        body: { credentials: { apiKey: 'c' } },
      }),
    );

    await unwrap(client.POST('/api/v1/sync', { body: { provider: 'TipRanks' } }));
    await jest.advanceTimersByTimeAsync(5_000);

    const [run] = await unwrap(client.GET('/api/v1/sync/runs'));
    expect(run).toMatchObject({
      status: 'Skipped',
      skipReason: 'No portfolio snapshot yet; synchronize eToro first.',
    });
  });
});

describe('the happy scenario: a synced demo portfolio', () => {
  it('shows a scored portfolio with every verdict, ordered by value', async () => {
    const { client } = setup('happy');

    const analysis = await unwrap(client.GET('/api/v1/portfolio/analysis'));

    const values = analysis.holdings.map((h) => h.holding.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(analysis.disclaimer).toMatch(/not investment advice/);

    const verdicts = new Set(analysis.holdings.map((h) => h.assessment.verdict));
    expect([...verdicts].sort()).toEqual(['Hold', 'HoldReviewSize', 'NoData', 'Review', 'Watch']);

    const bySymbol = Object.fromEntries(analysis.holdings.map((h) => [h.holding.symbol, h]));
    expect(bySymbol.NWND.assessment.verdict).toBe('HoldReviewSize');
    expect(bySymbol.NWND.assessment.weightPct).toBeGreaterThanOrEqual(25);
    expect(bySymbol.TLSP.assessment.verdict).toBe('Review');
    expect(bySymbol.FBRK.assessment.verdict).toBe('Watch');
    expect(bySymbol.ADWK.assessment.verdict).toBe('Watch');
    expect(bySymbol.LTWR.assessment.verdict).toBe('Watch');
    expect(bySymbol.ORBT.assessment.verdict).toBe('NoData');
    expect(bySymbol.TREY.assessment.verdict).toBe('NoData');
    expect(bySymbol.ALPSB.assessment.viaTicker).toBe('ALPS');
    expect(bySymbol['WWIM.DE'].assessment.facts.currency).toBe('EUR');
    expect(bySymbol.TLSP.assessment.flags.map((f) => f.key)).toEqual(
      expect.arrayContaining(['weak_consensus', 'deep_loss']),
    );
  });

  it('computes KPIs the way the backend does', async () => {
    const { client } = setup('happy');

    const { kpis, holdings } = await unwrap(client.GET('/api/v1/portfolio/analysis'));

    expect(kpis.positions).toBe(15);
    expect(kpis.top1Pct).toBeGreaterThan(25);
    expect(kpis.top5Pct).toBeGreaterThan(kpis.top1Pct);
    expect(kpis.smallPositions.count).toBe(holdings.filter((h) => !h.assessment.material).length);
    expect(kpis.smallPositions.count).toBeGreaterThanOrEqual(3);
    expect(kpis.earnings30DaysSymbols).toEqual(expect.arrayContaining(['NWND', 'CTSO', 'WGTP']));
    expect(Object.values(kpis.verdictCounts).reduce((a, b) => a + b, 0)).toBe(15);
    expect(kpis.weightedSmartScore).toBeGreaterThan(5);
  });

  it('keeps the account arithmetic consistent', async () => {
    const { client } = setup('happy');

    const portfolio = await unwrap(client.GET('/api/v1/portfolio'));

    const direct = portfolio.holdings.reduce((sum, h) => sum + h.value, 0);
    const copied = portfolio.copiedTraders.reduce((sum, c) => sum + c.value, 0);
    expect(portfolio.account.directValue).toBe(direct);
    expect(portfolio.account.copiedValue).toBe(copied);
    expect(portfolio.account.totalValue).toBe(direct + copied + portfolio.account.availableCash);
    const weights = portfolio.holdings.reduce((sum, h) => sum + h.weightPct, 0);
    expect(weights).toBeLessThan(100);
    expect(portfolio.lastSuccessfulSyncAt).not.toBeNull();
  });

  it('returns one holding with its signals, whatever the case of the symbol', async () => {
    const { client } = setup('happy');

    const detail = await unwrap(
      client.GET('/api/v1/portfolio/holdings/{symbol}', { params: { path: { symbol: 'nwnd' } } }),
    );

    expect(detail.analysis.holding.symbol).toBe('NWND');
    expect(detail.signals?.breadth?.analysts).toBe(31);
    expect(detail.signalsFetchedAt).not.toBeNull();
  });

  it('encodes symbols with a dot', async () => {
    const { client } = setup('happy');

    const detail = await unwrap(
      client.GET('/api/v1/portfolio/holdings/{symbol}', {
        params: { path: { symbol: 'WWIM.DE' } },
      }),
    );

    expect(detail.analysis.holding.tipRanksTicker).toBe('DE:WWIM');
  });

  it('reports an unknown holding', async () => {
    const { client } = setup('happy');

    const error = await failure(
      unwrap(
        client.GET('/api/v1/portfolio/holdings/{symbol}', { params: { path: { symbol: 'NOPE' } } }),
      ),
    );

    expect(error).toMatchObject({
      status: 404,
      code: 'holding.not_found',
      message: "The latest snapshot has no holding 'NOPE'.",
    });
  });

  it('lists the sync history and the snapshots, newest first, and validates paging', async () => {
    const { client } = setup('happy');

    const runs = await unwrap(client.GET('/api/v1/sync/runs', { params: { query: { take: 2 } } }));
    expect(runs).toHaveLength(2);
    expect(Date.parse(runs[0].requestedAt)).toBeGreaterThanOrEqual(Date.parse(runs[1].requestedAt));

    const snapshots = await unwrap(client.GET('/api/v1/portfolio/snapshots'));
    expect(snapshots[0]).toMatchObject({ positions: 15 });
    expect(snapshots[0].snapshotId).toMatch(/^\d{8}T\d{6}Z$/);

    for (const take of [0, 101]) {
      const error = await failure(
        unwrap(client.GET('/api/v1/sync/runs', { params: { query: { take } } })),
      );
      expect(error.status).toBe(400);
      expect(error.fieldErrors.take).toBeDefined();
    }
  });

  it('syncs again after the cooldown and moves the numbers a little', async () => {
    const { client } = setup('happy');
    const before = await unwrap(client.GET('/api/v1/portfolio'));

    await unwrap(client.POST('/api/v1/sync', { body: { provider: 'Etoro' } }));
    await jest.advanceTimersByTimeAsync(5_000);

    const after = await unwrap(client.GET('/api/v1/portfolio'));
    expect(after.account.totalValue).not.toBe(before.account.totalValue);
    expect(after.snapshotId).not.toBe(before.snapshotId);
    expect(await unwrap(client.GET('/api/v1/portfolio/snapshots'))).toHaveLength(2);
  });

  it('shows the next due sync from the plan interval', async () => {
    const { client } = setup('happy');

    const [etoro] = await unwrap(client.GET('/api/v1/integrations'));

    const last = Date.parse(etoro.lastSuccessfulSyncAt!);
    expect(Date.parse(etoro.nextSyncDueAt!) - last).toBe(10080 * 60_000);
  });
});

describe('failure scenarios', () => {
  it('rate-limited: TipRanks shows its failure and fails again when retried', async () => {
    const { client } = setup('rate-limited');

    const [, tipRanks] = await unwrap(client.GET('/api/v1/integrations'));
    expect(tipRanks.lastFailure?.kind).toBe('RateLimited');
    expect(Date.parse(tipRanks.nextSyncDueAt!)).toBeGreaterThan(NOW.getTime());

    await unwrap(client.POST('/api/v1/sync', { body: { provider: 'TipRanks' } }));
    await jest.advanceTimersByTimeAsync(5_000);

    const [run] = await unwrap(client.GET('/api/v1/sync/runs'));
    expect(run).toMatchObject({
      provider: 'TipRanks',
      status: 'Failed',
      failure: { kind: 'RateLimited' },
    });
  });

  it('credentials-rejected: eToro cannot sync until it is reconnected', async () => {
    const { client } = setup('credentials-rejected');

    const [etoro] = await unwrap(client.GET('/api/v1/integrations'));
    expect(etoro).toMatchObject({ status: 'CredentialsRejected', nextSyncDueAt: null });
    expect(etoro.lastFailure?.kind).toBe('Unauthorized');

    const blocked = await failure(
      unwrap(client.POST('/api/v1/sync', { body: { provider: 'Etoro' } })),
    );
    expect(blocked.code).toBe('sync.no_active_connection');

    const reconnected = await unwrap(
      client.PUT('/api/v1/integrations/{provider}', {
        params: { path: { provider: 'Etoro' } },
        body: { credentials: { apiKey: 'a', userKey: 'b' } },
      }),
    );
    expect(reconnected).toMatchObject({ status: 'Active', lastFailure: null });
  });

  it('failing: both providers are unavailable and nothing is ever synced', async () => {
    const { client } = setup('failing');
    expect((await failure(unwrap(client.GET('/api/v1/portfolio')))).code).toBe(
      'portfolio.not_synced',
    );

    await unwrap(client.POST('/api/v1/sync', { body: { provider: null } }));
    await jest.advanceTimersByTimeAsync(10_000);

    const runs = await unwrap(client.GET('/api/v1/sync/runs'));
    expect(runs.map((r) => [r.provider, r.status, r.failure?.kind])).toEqual([
      ['Etoro', 'Failed', 'Unavailable'],
      ['TipRanks', 'Failed', 'Unavailable'],
    ]);
    const integrations = await unwrap(client.GET('/api/v1/integrations'));
    expect(integrations.every((i) => i.lastFailure?.kind === 'Unavailable')).toBe(true);
  });
});

describe('reset', () => {
  it('cancels running syncs and starts the scenario over', async () => {
    const { client, backend } = setup('empty');
    await unwrap(
      client.PUT('/api/v1/me', { body: { displayName: 'Ada', email: 'ada@example.com' } }),
    );
    await unwrap(
      client.PUT('/api/v1/integrations/{provider}', {
        params: { path: { provider: 'Etoro' } },
        body: { credentials: { apiKey: 'a', userKey: 'b' } },
      }),
    );
    await unwrap(client.POST('/api/v1/sync', { body: { provider: 'Etoro' } }));

    backend.reset();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(backend.state().user).toBeNull();
    expect(backend.state().runs).toEqual([]);
    expect(backend.state().snapshots).toEqual([]);
  });
});

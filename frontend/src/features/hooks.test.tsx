import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestApi } from '@/test/apiTestUtils';

import { useConnectProvider, useIntegrations } from './integrations/hooks';
import { useAnalysis, useHolding, usePortfolio, useSnapshots } from './portfolio/hooks';
import { useMe, useUpsertProfile } from './profile/hooks';
import { useRefreshWhenSyncCompletes, useRequestSync, useSyncRuns } from './sync/hooks';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('profile hooks', () => {
  it('treats a user who has not registered as data (null), then shows the profile once saved', async () => {
    const { wrapper } = createTestApi('empty');
    const me = await renderHook(() => useMe(), { wrapper });
    const upsert = await renderHook(() => useUpsertProfile(), { wrapper });

    await waitFor(() => expect(me.result.current.isSuccess).toBe(true));
    expect(me.result.current.data).toBeNull();

    await act(async () => {
      await upsert.result.current.mutateAsync({ displayName: 'Ada', email: 'ada@example.com' });
    });

    await waitFor(() => expect(me.result.current.data?.displayName).toBe('Ada'));
  });

  it('surfaces validation errors from saving the profile', async () => {
    const { wrapper } = createTestApi('empty');
    const upsert = await renderHook(() => useUpsertProfile(), { wrapper });

    await act(async () => {
      await upsert.result.current
        .mutateAsync({ displayName: 'Ada', email: 'nope' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(upsert.result.current.isError).toBe(true));
    expect(upsert.result.current.error).toMatchObject({
      status: 400,
      fieldErrors: { email: expect.any(Array) },
    });
  });
});

describe('portfolio hooks', () => {
  it('treats a portfolio that is not synced yet as data (null), not as an error', async () => {
    const { wrapper } = createTestApi('failing');
    const analysis = await renderHook(() => useAnalysis(), { wrapper });
    const portfolio = await renderHook(() => usePortfolio(), { wrapper });
    const holding = await renderHook(() => useHolding('NWND'), { wrapper });

    await waitFor(() => expect(analysis.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(portfolio.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(holding.result.current.isSuccess).toBe(true));
    expect(analysis.result.current.data).toBeNull();
    expect(portfolio.result.current.data).toBeNull();
    expect(holding.result.current.data).toBeNull();
  });

  it('loads the scored portfolio, one holding and the snapshots', async () => {
    const { wrapper } = createTestApi('happy');
    const analysis = await renderHook(() => useAnalysis(), { wrapper });
    const holding = await renderHook(() => useHolding('CTSO'), { wrapper });
    const unknown = await renderHook(() => useHolding('NOPE'), { wrapper });
    const snapshots = await renderHook(() => useSnapshots(), { wrapper });
    const idle = await renderHook(() => useHolding('NWND', { enabled: false }), { wrapper });

    await waitFor(() => expect(analysis.result.current.data?.holdings).toHaveLength(15));
    await waitFor(() => expect(holding.result.current.data?.analysis.holding.symbol).toBe('CTSO'));
    await waitFor(() => expect(unknown.result.current.isSuccess).toBe(true));
    expect(unknown.result.current.data).toBeNull();
    await waitFor(() => expect(snapshots.result.current.data).toHaveLength(1));
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('integration hooks', () => {
  it('connects a provider and refreshes the list without keeping the credentials', async () => {
    const { wrapper, queryClient } = createTestApi('empty');
    await renderHook(() => useMe(), { wrapper });
    const upsert = await renderHook(() => useUpsertProfile(), { wrapper });
    await act(async () => {
      await upsert.result.current.mutateAsync({ displayName: 'Ada', email: 'ada@example.com' });
    });
    const integrations = await renderHook(() => useIntegrations(), { wrapper });
    const connect = await renderHook(() => useConnectProvider(), { wrapper });
    await waitFor(() => expect(integrations.result.current.data?.[0].status).toBeNull());

    await act(async () => {
      await connect.result.current.mutateAsync({
        provider: 'TipRanks',
        credentials: { apiKey: 'SECRET' },
      });
    });
    await waitFor(() => expect(integrations.result.current.data?.[1].status).toBe('Active'));

    expect(JSON.stringify(integrations.result.current.data)).not.toContain('SECRET');
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => JSON.stringify(q.state.data)),
    ).not.toContain('SECRET');
    expect(connect.result.current.isSuccess).toBe(true);
  });
});

describe('sync hooks', () => {
  it('queues a sync, polls until it finishes, then refreshes the portfolio', async () => {
    const { wrapper, backend } = createTestApi('happy');
    const analysis = await renderHook(() => useAnalysis(), { wrapper });
    const runs = await renderHook(
      () => {
        useRefreshWhenSyncCompletes();
        return useSyncRuns();
      },
      { wrapper },
    );
    const request = await renderHook(() => useRequestSync(), { wrapper });
    await waitFor(() => expect(analysis.result.current.data).not.toBeUndefined());
    await waitFor(() => expect(runs.result.current.isSuccess).toBe(true));
    const before = analysis.result.current.data?.snapshotId;
    const runsBefore = runs.result.current.data?.length ?? 0;

    await act(async () => {
      await request.result.current.mutateAsync('Etoro');
    });

    await waitFor(() => expect(runs.result.current.data).toHaveLength(runsBefore + 1));
    expect(runs.result.current.data?.[0]).toMatchObject({ provider: 'Etoro', status: 'Queued' });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(9_000);
    });

    await waitFor(() => expect(runs.result.current.data?.[0].status).toBe('Succeeded'));
    await waitFor(() => expect(analysis.result.current.data?.snapshotId).not.toBe(before));
    expect(backend.state().snapshots).toHaveLength(2);
  });

  it('reports the cooldown problem of a second manual sync', async () => {
    const { wrapper } = createTestApi('happy');
    const request = await renderHook(() => useRequestSync(), { wrapper });

    await act(async () => {
      await request.result.current.mutateAsync('Etoro');
    });
    await act(async () => {
      await request.result.current.mutateAsync('Etoro').catch(() => undefined);
    });

    await waitFor(() => expect(request.result.current.isError).toBe(true));
    expect(request.result.current.error).toMatchObject({ status: 429, code: 'sync.cooldown' });
  });
});

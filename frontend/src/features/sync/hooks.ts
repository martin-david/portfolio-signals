import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useApiClient } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';
import { unwrap } from '@/api/request';
import type { IntegrationProvider, SyncRunDto } from '@/api/schema';

import {
  SYNC_POLL_INTERVAL_MS,
  hasActiveRuns,
  isActiveRun,
  mergeRuns,
  runsThatFinished,
} from './runs';

export const SYNC_HISTORY_SIZE = 20;

/** Sync history, newest first. Polls while a run is queued or running. */
export function useSyncRuns(take: number = SYNC_HISTORY_SIZE) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.syncRuns(take),
    queryFn: ({ signal }) =>
      unwrap(client.GET('/api/v1/sync/runs', { params: { query: { take } }, signal })),
    refetchInterval: (query) => (hasActiveRuns(query.state.data) ? SYNC_POLL_INTERVAL_MS : false),
  });
}

/** Queues a manual sync for one provider, or for every active connection when no provider is given. */
export function useRequestSync() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider?: IntegrationProvider) =>
      unwrap(client.POST('/api/v1/sync', { body: { provider: provider ?? null } })),
    onSuccess: (created) => {
      queryClient.setQueriesData<SyncRunDto[]>({ queryKey: queryKeys.syncRunsAll }, (existing) =>
        mergeRuns(created, existing),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    },
  });
}

/**
 * Mount once in the app shell: when a queued or running sync finishes, everything derived from it is refetched,
 * whichever screen is open.
 */
export function useRefreshWhenSyncCompletes(): void {
  const { data: runs } = useSyncRuns();
  const queryClient = useQueryClient();
  const previouslyActive = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!runs) {
      return;
    }
    const finished = runsThatFinished(previouslyActive.current, runs);
    previouslyActive.current = new Set(runs.filter(isActiveRun).map((run) => run.id));
    if (finished.length > 0) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    }
  }, [runs, queryClient]);
}

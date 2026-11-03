import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';
import { unwrap, unwrapEmpty } from '@/api/request';
import type { IntegrationProvider } from '@/api/schema';

export function useIntegrations() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.integrations,
    queryFn: ({ signal }) => unwrap(client.GET('/api/v1/integrations', { signal })),
  });
}

export interface ConnectInput {
  provider: IntegrationProvider;
  /** Write-only: sent once and never kept or shown again. */
  credentials: Record<string, string>;
}

export function useConnectProvider() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, credentials }: ConnectInput) =>
      unwrap(
        client.PUT('/api/v1/integrations/{provider}', {
          params: { path: { provider } },
          body: { credentials },
        }),
      ),
    // Nothing may keep the secrets once the request settles.
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations }),
  });
}

export function useDisconnectProvider() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      unwrapEmpty(
        client.DELETE('/api/v1/integrations/{provider}', { params: { path: { provider } } }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations }),
  });
}

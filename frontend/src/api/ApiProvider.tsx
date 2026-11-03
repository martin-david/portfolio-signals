import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AppConfig } from '@/config/env';

import { createApiClient, type ApiClient, type AuthHooks, type FetchLike } from './createApiClient';

const ApiClientContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
  config: AppConfig;
  auth: AuthHooks;
  queryClient: QueryClient;
  /** Replaces the network (tests). */
  fetchImpl?: FetchLike;
  children: ReactNode;
}

export function ApiProvider({ config, auth, queryClient, fetchImpl, children }: ApiProviderProps) {
  const client = useMemo(
    () => createApiClient({ config, fetchImpl, ...auth }),
    // The auth hooks are stable functions of the session, so they identify it.
    [config, fetchImpl, auth],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>
    </QueryClientProvider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error('useApiClient must be used inside ApiProvider.');
  }
  return client;
}

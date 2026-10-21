import { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import type { AuthHooks } from '@/api/createApiClient';
import type { AppConfig, MockScenario } from '@/config/env';
import { createMockBackend } from '@/mocks/mockBackend';

const config: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'happy',
};

/** The real client, hooks and TanStack Query over the demo backend. */
export function createTestApi(scenario: MockScenario) {
  const backend = createMockBackend({ scenario });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const auth: AuthHooks = { getAuthHeaders: async () => ({ 'X-Dev-User': 'tester' }) };

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider config={config} auth={auth} queryClient={queryClient} fetchImpl={backend.fetch}>
        {children}
      </ApiProvider>
    );
  }

  return { backend, queryClient, wrapper };
}

import { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiProvider } from '@/api/ApiProvider';
import type { AuthHooks, FetchLike } from '@/api/createApiClient';
import type { AppConfig, MockScenario } from '@/config/env';
import { createMockBackend, type MockBackend } from '@/mocks/mockBackend';

const config: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'happy',
};

/** Sees every request first and may answer it itself, or hand it on to the demo backend. */
export type Intercept = (request: Request, forward: FetchLike) => Promise<Response>;

export interface TestApiOptions {
  intercept?: Intercept;
}

/** The real client, hooks and TanStack Query over the demo backend. */
export function createTestApi(scenario: MockScenario, options: TestApiOptions = {}) {
  const backend = createMockBackend({ scenario });
  const { intercept } = options;
  const fetchImpl: FetchLike = intercept
    ? (request) => intercept(request, backend.fetch)
    : backend.fetch;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const auth: AuthHooks = { getAuthHeaders: async () => ({ 'X-Dev-User': 'tester' }) };

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider config={config} auth={auth} queryClient={queryClient} fetchImpl={fetchImpl}>
        {children}
      </ApiProvider>
    );
  }

  return { backend, queryClient, wrapper };
}

/** Registers the test user, as the profile screen does. The `empty` scenario starts without one. */
export async function registerTestUser(backend: MockBackend): Promise<void> {
  await backend.fetch(
    new Request('https://mock.invalid/api/v1/me', {
      method: 'PUT',
      headers: { 'X-Dev-User': 'tester', 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ada', email: 'ada@example.test' }),
    }),
  );
}

/** Sends a request to the demo backend as the test user, outside the app (to set the scene for a test). */
export async function callBackend(
  backend: MockBackend,
  method: 'PUT' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Response> {
  return backend.fetch(
    new Request(`https://mock.invalid/api/v1${path}`, {
      method,
      headers: { 'X-Dev-User': 'tester', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

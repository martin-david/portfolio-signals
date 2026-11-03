import createClient from 'openapi-fetch';

import type { AppConfig } from '@/config/env';

import type { paths } from './schema';
import { loadDemoApi } from './mockLoader';

export type ApiClient = ReturnType<typeof createClient<paths>>;
export type FetchLike = (request: Request) => Promise<Response>;

export interface AuthHooks {
  /** Headers that identify the signed-in user: a bearer token, or the development user header. */
  getAuthHeaders(): Promise<Record<string, string>>;
  /** Called once after a 401. Resolves true when new credentials are available and the request may be retried. */
  refreshCredentials?(): Promise<boolean>;
}

export interface ApiClientOptions extends AuthHooks {
  config: AppConfig;
  /** Replaces the network (tests). */
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;

async function authorise(request: Request, auth: AuthHooks): Promise<Request> {
  const headers = new Headers(request.headers);
  for (const [name, value] of Object.entries(await auth.getAuthHeaders())) {
    headers.set(name, value);
  }
  return new Request(request, { headers });
}

/** Adds the user's credentials to every request and retries once with refreshed credentials after a 401. */
export function withAuth(baseFetch: FetchLike, auth: AuthHooks): FetchLike {
  return async (request) => {
    const retry = request.clone();
    const response = await baseFetch(await authorise(request, auth));
    if (response.status !== 401 || !auth.refreshCredentials) {
      return response;
    }
    if (!(await auth.refreshCredentials())) {
      return response;
    }
    return baseFetch(await authorise(retry, auth));
  };
}

/** Aborts a request that takes longer than the limit, while still honouring the caller's own abort signal. */
export function withTimeout(baseFetch: FetchLike, timeoutMs: number): FetchLike {
  return async (request) => {
    const controller = new AbortController();
    const abortWithCaller = () => controller.abort();
    const caller = request.signal;
    if (caller?.aborted) {
      // The caller gave up before the request started; its abort event has already fired.
      controller.abort();
    } else {
      caller?.addEventListener('abort', abortWithCaller, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await baseFetch(new Request(request, { signal: controller.signal }));
    } catch (error) {
      if (timedOut) {
        const timeout = new Error(`The request timed out after ${timeoutMs} ms.`);
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      caller?.removeEventListener('abort', abortWithCaller);
    }
  };
}

function resolveBaseFetch(config: AppConfig): FetchLike {
  if (config.apiMode === 'mock') {
    return (request) => loadDemoApi().getMockFetch(config.mockScenario)(request);
  }
  return (request) => fetch(request);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseFetch = options.fetchImpl ?? resolveBaseFetch(options.config);
  const timed = withTimeout(baseFetch, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return createClient<paths>({
    baseUrl: options.config.apiBaseUrl,
    fetch: withAuth(timed, options),
    headers: { Accept: 'application/json' },
  });
}

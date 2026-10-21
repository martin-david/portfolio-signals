import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isRetryable, isUnauthorized } from './errors';

export interface QueryClientOptions {
  /** Called when a request is still unauthorised after credentials were refreshed. */
  onUnauthorized: () => void;
}

export const MAX_RETRIES = 2;

export function createQueryClient(options: QueryClientOptions): QueryClient {
  const handle = (error: unknown) => {
    if (isUnauthorized(error)) {
      options.onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: {
        // Client errors (400, 404, 409, 429) will not fix themselves; only transient failures are retried.
        retry: (failureCount, error) => isRetryable(error) && failureCount < MAX_RETRIES,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}

import type { QueryClient } from '@tanstack/react-query';

import { createQueryClient } from '@/api/queryClient';
import { createAuthController, createAuthStrategy, type AuthController } from '@/auth';
import type { KeyValueStore } from '@/auth/storage';
import type { AppConfig } from '@/config/env';

export interface AppServices {
  auth: AuthController;
  queryClient: QueryClient;
}

/** The objects that live as long as the app: the session and the cache of what the API said. */
export function createAppServices(config: AppConfig, store?: KeyValueStore): AppServices {
  const auth = createAuthController(createAuthStrategy(config, store));
  const queryClient = createQueryClient({ onUnauthorized: () => auth.expire() });
  // Nothing fetched with one person's credentials may outlive their session.
  auth.subscribe(() => {
    if (auth.getState().status === 'signedOut') {
      queryClient.clear();
    }
  });
  return { auth, queryClient };
}

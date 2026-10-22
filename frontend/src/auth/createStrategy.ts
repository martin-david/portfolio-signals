import type { AppConfig } from '@/config/env';
import { loadDemoApi } from '@/api/mockLoader';

import { createExpoOidcClient } from './expoOidcClient';
import { createDevStrategy } from './devStrategy';
import { createMockStrategy } from './mockStrategy';
import { createOidcStrategy } from './oidcStrategy';
import { createSessionStore } from './sessionStore';
import { createDefaultStore, type KeyValueStore } from './storage';
import type { AuthStrategy } from './types';

/** The sign-in this build was configured for. */
export function createAuthStrategy(
  config: AppConfig,
  store: KeyValueStore = createDefaultStore(),
): AuthStrategy {
  switch (config.authMode) {
    case 'dev':
      return createDevStrategy(store);
    case 'mock':
      return createMockStrategy({
        // Signing out starts the demo over.
        onSignOut: () => loadDemoApi().resetMockBackend(config.mockScenario),
      });
    case 'oidc':
      if (!config.oidc) {
        throw new Error('OIDC sign-in is configured without an authority and client id.');
      }
      return createOidcStrategy({
        config: config.oidc,
        store: createSessionStore(store),
        client: createExpoOidcClient(),
      });
  }
}

import type { OidcConfig } from '@/config/env';

import { suggestedProfileFrom } from './jwt';
import type { SessionStore, StoredSession } from './sessionStore';
import { AuthError, type AuthStrategy } from './types';

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number | null;
}

export type AuthorizeResult =
  { type: 'success'; tokens: TokenSet } | { type: 'cancel' } | { type: 'error'; message: string };

export type RefreshResult = { type: 'success'; tokens: TokenSet } | { type: 'rejected' };

/** The part of an OpenID Connect client the app needs. expoOidcClient.ts implements it with expo-auth-session. */
export interface OidcClient {
  /** Authorization code flow with PKCE in the system browser (a popup on web). */
  authorize(config: OidcConfig): Promise<AuthorizeResult>;
  /** Rejects when the provider cannot be reached; resolves `rejected` when it refused the refresh token. */
  refresh(config: OidcConfig, refreshToken: string): Promise<RefreshResult>;
  revoke(config: OidcConfig, refreshToken: string): Promise<void>;
}

export interface OidcStrategyOptions {
  config: OidcConfig;
  store: SessionStore;
  client: OidcClient;
  now?: () => number;
}

/** A token that expires within this long is refreshed before it is used. */
export const EXPIRY_SKEW_MS = 60_000;

/** Bearer-token sign-in against an OpenID Connect provider, with refresh-token renewal. */
export function createOidcStrategy({
  config,
  store,
  client,
  now = Date.now,
}: OidcStrategyOptions): AuthStrategy {
  let session: StoredSession | null = null;
  let refreshing: Promise<boolean> | null = null;

  async function replace(next: StoredSession | null) {
    session = next;
    if (next) {
      await store.save(next);
    } else {
      await store.clear();
    }
  }

  async function refresh(): Promise<boolean> {
    const current = session;
    if (!current?.refreshToken) {
      return false;
    }
    let result: RefreshResult;
    try {
      result = await client.refresh(config, current.refreshToken);
    } catch {
      // The provider could not be reached: keep the session, the next request tries again.
      return false;
    }
    if (result.type === 'rejected') {
      await replace(null);
      return false;
    }
    await replace({
      accessToken: result.tokens.accessToken,
      // A provider that does not rotate refresh tokens leaves the old one valid.
      refreshToken: result.tokens.refreshToken ?? current.refreshToken,
      expiresAt: result.tokens.expiresAt,
      suggestedProfile: current.suggestedProfile,
    });
    return true;
  }

  // Refresh tokens are often single-use, so concurrent requests must share one refresh.
  function refreshOnce(): Promise<boolean> {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  return {
    mode: 'oidc',

    async restore() {
      const stored = await store.load();
      if (!stored) {
        return null;
      }
      const expired = stored.expiresAt !== null && stored.expiresAt <= now();
      if (expired && !stored.refreshToken) {
        await store.clear();
        return null;
      }
      session = stored;
      return { suggestedProfile: stored.suggestedProfile };
    },

    async signIn() {
      let result: AuthorizeResult;
      try {
        result = await client.authorize(config);
      } catch {
        throw new AuthError(
          'The identity provider could not be reached. Check your connection and try again.',
        );
      }
      if (result.type === 'cancel') {
        return null;
      }
      if (result.type === 'error') {
        throw new AuthError(result.message);
      }
      const suggestedProfile = suggestedProfileFrom(result.tokens.idToken);
      await replace({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresAt: result.tokens.expiresAt,
        suggestedProfile,
      });
      return { suggestedProfile };
    },

    async signOut() {
      const refreshToken = session?.refreshToken;
      await replace(null);
      if (refreshToken) {
        // Ending the session here must not wait for, or depend on, the provider.
        client.revoke(config, refreshToken).catch(() => undefined);
      }
    },

    async getAuthHeaders(): Promise<Record<string, string>> {
      const current = session;
      if (
        current?.refreshToken &&
        current.expiresAt !== null &&
        current.expiresAt - now() < EXPIRY_SKEW_MS
      ) {
        await refreshOnce();
      }
      return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
    },

    refreshCredentials: refreshOnce,
  };
}

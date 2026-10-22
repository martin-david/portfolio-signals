import type { KeyValueStore } from './storage';
import type { SuggestedProfile } from './types';

/** What an OIDC sign-in leaves behind. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds at which the access token stops working, or null when the provider did not say. */
  expiresAt: number | null;
  suggestedProfile: SuggestedProfile | null;
}

export interface SessionStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export const SESSION_KEYS = {
  access: 'portfolio-signals.auth.access',
  refresh: 'portfolio-signals.auth.refresh',
  meta: 'portfolio-signals.auth.meta',
} as const;

interface Meta {
  expiresAt: number | null;
  suggestedProfile: SuggestedProfile | null;
}

function parseMeta(raw: string | null): Meta {
  const empty: Meta = { expiresAt: null, suggestedProfile: null };
  if (!raw) {
    return empty;
  }
  try {
    const value = JSON.parse(raw) as Partial<Meta> | null;
    const profile = value?.suggestedProfile;
    return {
      expiresAt: typeof value?.expiresAt === 'number' ? value.expiresAt : null,
      suggestedProfile:
        profile && typeof profile.displayName === 'string' && typeof profile.email === 'string'
          ? { displayName: profile.displayName, email: profile.email }
          : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Keeps the tokens in separate entries because the platform keystores limit how much one entry can hold, and a
 * provider's access and refresh tokens together can be large.
 */
export function createSessionStore(store: KeyValueStore): SessionStore {
  return {
    async load() {
      const accessToken = await store.get(SESSION_KEYS.access);
      if (!accessToken) {
        return null;
      }
      const [refreshToken, meta] = await Promise.all([
        store.get(SESSION_KEYS.refresh),
        store.get(SESSION_KEYS.meta),
      ]);
      return { accessToken, refreshToken, ...parseMeta(meta) };
    },
    async save(session) {
      await store.set(SESSION_KEYS.access, session.accessToken);
      if (session.refreshToken) {
        await store.set(SESSION_KEYS.refresh, session.refreshToken);
      } else {
        await store.remove(SESSION_KEYS.refresh);
      }
      const meta: Meta = {
        expiresAt: session.expiresAt,
        suggestedProfile: session.suggestedProfile,
      };
      await store.set(SESSION_KEYS.meta, JSON.stringify(meta));
    },
    async clear() {
      await Promise.all(Object.values(SESSION_KEYS).map((key) => store.remove(key)));
    },
  };
}

import type { KeyValueStore } from './storage';
import { AuthError, type AuthStrategy, type SessionInfo } from './types';

export const DEV_USER_KEY = 'portfolio-signals.auth.dev-user';
export const DEV_USER_HEADER = 'X-Dev-User';
export const DEFAULT_DEV_USER = 'demo';

const DEV_USER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** A message when the name cannot be sent as a header value, otherwise null. */
export function checkDevUser(name: string): string | null {
  return DEV_USER_PATTERN.test(name.trim())
    ? null
    : 'Use 1 to 64 letters, digits, dots, dashes or underscores.';
}

function infoFor(name: string): SessionInfo {
  // The same claims the backend's development handler invents for this user.
  return { suggestedProfile: { displayName: name, email: `${name}@example.test` } };
}

/**
 * Development sign-in: the person names themselves and the backend, running in its Development mode, believes
 * them. Config validation keeps this out of production builds.
 */
export function createDevStrategy(store: KeyValueStore): AuthStrategy {
  let user: string | null = null;
  return {
    mode: 'dev',
    async restore() {
      const saved = (await store.get(DEV_USER_KEY))?.trim();
      if (!saved || checkDevUser(saved)) {
        return null;
      }
      user = saved;
      return infoFor(saved);
    },
    async signIn(input) {
      const name = (input?.devUser ?? '').trim();
      const problem = checkDevUser(name);
      if (problem) {
        throw new AuthError(problem);
      }
      user = name;
      await store.set(DEV_USER_KEY, name);
      return infoFor(name);
    },
    async signOut() {
      user = null;
      await store.remove(DEV_USER_KEY);
    },
    async getAuthHeaders(): Promise<Record<string, string>> {
      return user ? { [DEV_USER_HEADER]: user } : {};
    },
  };
}

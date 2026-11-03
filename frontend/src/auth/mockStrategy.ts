import type { AuthStrategy } from './types';

export const DEMO_PROFILE = { displayName: 'Demo investor', email: 'demo.investor@example.test' };

/** Sign-in for the demo API: there is nobody to prove anything to. Each reload starts the demo over. */
export function createMockStrategy(options: { onSignOut?: () => void } = {}): AuthStrategy {
  let signedIn = false;
  return {
    mode: 'mock',
    async restore() {
      return null;
    },
    async signIn() {
      signedIn = true;
      return { suggestedProfile: DEMO_PROFILE };
    },
    async signOut() {
      signedIn = false;
      options.onSignOut?.();
    },
    async getAuthHeaders(): Promise<Record<string, string>> {
      return signedIn ? { Authorization: 'Bearer demo-session' } : {};
    },
  };
}

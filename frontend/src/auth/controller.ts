import type { AuthHooks } from '@/api/createApiClient';
import type { AuthMode } from '@/config/env';

import type { AuthStrategy, SessionInfo, SignInInput, SuggestedProfile } from './types';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  suggestedProfile: SuggestedProfile | null;
  /** The person was signed out because the API stopped accepting their credentials. */
  expired: boolean;
}

export interface AuthController {
  readonly mode: AuthMode;
  /** Stable for the life of the controller, so the API client is not rebuilt while the session changes. */
  readonly hooks: AuthHooks;
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  restore(): Promise<void>;
  /** Rejects with AuthError when the sign-in failed; resolves without a change when the person backed out. */
  signIn(input?: SignInInput): Promise<void>;
  signOut(): Promise<void>;
  /** The API refused the credentials for good: end the session and say why. */
  expire(): void;
}

const RESTORING: AuthState = { status: 'restoring', suggestedProfile: null, expired: false };

function signedOut(expired = false): AuthState {
  return { status: 'signedOut', suggestedProfile: null, expired };
}

function signedIn(info: SessionInfo): AuthState {
  return { status: 'signedIn', suggestedProfile: info.suggestedProfile, expired: false };
}

/** The session of the app: one state machine over whichever strategy this build signs in with. */
export function createAuthController(strategy: AuthStrategy): AuthController {
  let state = RESTORING;
  const listeners = new Set<() => void>();
  let restoring: Promise<void> | null = null;
  let signingIn: Promise<void> | null = null;

  function set(next: AuthState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  const hooks: AuthHooks = {
    getAuthHeaders: () => strategy.getAuthHeaders(),
    refreshCredentials: strategy.refreshCredentials
      ? () => strategy.refreshCredentials!()
      : undefined,
  };

  return {
    mode: strategy.mode,
    hooks,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    restore() {
      restoring ??= (async () => {
        try {
          const info = await strategy.restore();
          set(info ? signedIn(info) : signedOut());
        } catch {
          set(signedOut());
        }
      })();
      return restoring;
    },

    signIn(input) {
      signingIn ??= (async () => {
        try {
          const info = await strategy.signIn(input);
          if (info) {
            set(signedIn(info));
          }
        } finally {
          signingIn = null;
        }
      })();
      return signingIn;
    },

    async signOut() {
      try {
        await strategy.signOut();
      } finally {
        set(signedOut());
      }
    },

    expire() {
      if (state.status !== 'signedIn') {
        return;
      }
      strategy.signOut().catch(() => undefined);
      set(signedOut(true));
    },
  };
}
